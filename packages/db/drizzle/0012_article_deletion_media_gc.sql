DROP VIEW IF EXISTS "published_articles";--> statement-breakpoint
ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_ready_metadata_check";--> statement-breakpoint
ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_non_ready_public_key_check";--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."media_status" RENAME TO "media_status_previous";--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'quarantined', 'deleting');--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "status" TYPE "public"."media_status" USING "status"::text::"public"."media_status";--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
DROP TYPE "public"."media_status_previous";--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_ready_metadata_check"
CHECK ("media_assets"."status" <> 'ready' or ("media_assets"."public_object_key" is not null and "media_assets"."checksum_sha256" is not null and "media_assets"."width" is not null and "media_assets"."height" is not null));--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_non_ready_public_key_check"
CHECK ("media_assets"."status" in ('ready', 'deleting') or "media_assets"."public_object_key" is null);--> statement-breakpoint
ALTER TABLE "article_revisions" DROP CONSTRAINT "article_revisions_body_root_check";--> statement-breakpoint
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_body_root_check"
CHECK (
	COALESCE(
		("body" ->> 'schemaVersion') IN ('1', '2')
		AND ("body" ->> 'type') = 'doc',
		false
	)
);--> statement-breakpoint
CREATE TABLE "article_media_references" (
	"article_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	CONSTRAINT "article_media_references_article_id_media_id_pk" PRIMARY KEY("article_id","media_id")
);--> statement-breakpoint
CREATE TABLE "preview_media_references" (
	"snapshot_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	CONSTRAINT "preview_media_references_snapshot_id_media_id_pk" PRIMARY KEY("snapshot_id","media_id")
);--> statement-breakpoint
ALTER TABLE "article_media_references" ADD CONSTRAINT "article_media_references_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_media_references" ADD CONSTRAINT "article_media_references_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_media_references" ADD CONSTRAINT "preview_media_references_snapshot_id_preview_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."preview_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_media_references" ADD CONSTRAINT "preview_media_references_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_media_references_media_idx" ON "article_media_references" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "preview_media_references_media_idx" ON "preview_media_references" USING btree ("media_id");--> statement-breakpoint
INSERT INTO "article_media_references" ("article_id", "media_id")
SELECT DISTINCT revision."article_id", media."id"
FROM "article_revisions" AS revision
INNER JOIN "media_assets" AS media ON media."id" = revision."cover_media_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH RECURSIVE revision_nodes(article_id, node) AS (
	SELECT revision."article_id", top_level.node
	FROM "article_revisions" AS revision
	CROSS JOIN LATERAL jsonb_array_elements(COALESCE(revision."body" -> 'content', '[]'::jsonb)) AS top_level(node)
	UNION ALL
	SELECT parent.article_id, child.node
	FROM revision_nodes AS parent
	CROSS JOIN LATERAL jsonb_array_elements(
		CASE WHEN jsonb_typeof(parent.node -> 'content') = 'array'
		THEN parent.node -> 'content' ELSE '[]'::jsonb END
	) AS child(node)
)
INSERT INTO "article_media_references" ("article_id", "media_id")
SELECT DISTINCT node.article_id, media."id"
FROM revision_nodes AS node
INNER JOIN "media_assets" AS media ON media."id"::text = node.node -> 'attrs' ->> 'mediaId'
WHERE node.node ->> 'type' = 'image'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "preview_media_references" ("snapshot_id", "media_id")
SELECT DISTINCT snapshot."id", media."id"
FROM "preview_snapshots" AS snapshot
INNER JOIN "media_assets" AS media ON media."id"::text = snapshot."payload" ->> 'coverMediaId'
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH RECURSIVE snapshot_nodes(snapshot_id, node) AS (
	SELECT snapshot."id", top_level.node
	FROM "preview_snapshots" AS snapshot
	CROSS JOIN LATERAL jsonb_array_elements(COALESCE(snapshot."payload" -> 'body' -> 'content', '[]'::jsonb)) AS top_level(node)
	UNION ALL
	SELECT parent.snapshot_id, child.node
	FROM snapshot_nodes AS parent
	CROSS JOIN LATERAL jsonb_array_elements(
		CASE WHEN jsonb_typeof(parent.node -> 'content') = 'array'
		THEN parent.node -> 'content' ELSE '[]'::jsonb END
	) AS child(node)
)
INSERT INTO "preview_media_references" ("snapshot_id", "media_id")
SELECT DISTINCT node.snapshot_id, media."id"
FROM snapshot_nodes AS node
INNER JOIN "media_assets" AS media ON media."id"::text = node.node -> 'attrs' ->> 'mediaId'
WHERE node.node ->> 'type' = 'image'
ON CONFLICT DO NOTHING;--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_immutable_event_change() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_TABLE_NAME = 'article_revisions'
		AND TG_OP = 'DELETE'
		AND pg_trigger_depth() > 1
		AND current_setting('nite.cms_delete_article_id', true) = OLD.article_id::text THEN
		RETURN OLD;
	END IF;
	RAISE EXCEPTION '% sao imutaveis', TG_TABLE_NAME;
END;
$$;--> statement-breakpoint
CREATE VIEW "published_articles"
WITH (security_barrier = true)
AS
SELECT
	a."id" AS "article_id",
	r."id" AS "revision_id",
	r."content_schema_version",
	a."slug",
	a."published_at",
	a."featured",
	r."title",
	r."summary",
	r."category",
	r."event_date",
	r."read_time_minutes",
	r."byline",
	m."public_object_key" AS "cover_object_key",
	r."cover_alt",
	r."cover_caption",
	r."cover_credit",
	r."body",
	COALESCE(
		(
			SELECT jsonb_object_agg(
				embedded_media."id"::text,
				jsonb_build_object(
					'objectKey', embedded_media."public_object_key",
					'width', embedded_media."width",
					'height', embedded_media."height"
				)
			)
			FROM (
				WITH RECURSIVE nested_nodes(node) AS (
					SELECT top_level.node
					FROM jsonb_array_elements(COALESCE(r."body" -> 'content', '[]'::jsonb)) AS top_level(node)
					UNION ALL
					SELECT child.node
					FROM nested_nodes AS parent
					CROSS JOIN LATERAL jsonb_array_elements(
						CASE
							WHEN jsonb_typeof(parent.node -> 'content') = 'array'
							THEN parent.node -> 'content'
							ELSE '[]'::jsonb
						END
					) AS child(node)
				)
				SELECT node
				FROM nested_nodes
				WHERE node ->> 'type' = 'image'
			) AS embedded_node
			INNER JOIN "media_assets" AS embedded_media
				ON embedded_media."id"::text = embedded_node.node -> 'attrs' ->> 'mediaId'
				AND embedded_media."status" = 'ready'
		),
		'{}'::jsonb
	) AS "body_media",
	r."seo",
	true AS "public",
	'real'::text AS "content_state"
FROM "articles" AS a
INNER JOIN "article_revisions" AS r
	ON r."id" = a."published_revision_id"
	AND r."article_id" = a."id"
INNER JOIN "media_assets" AS m
	ON m."id" = r."cover_media_id"
	AND m."status" = 'ready'
WHERE a."status" = 'published'
	AND a."published_at" <= now()
	AND NOT EXISTS (
		WITH RECURSIVE nested_nodes(node) AS (
			SELECT top_level.node
			FROM jsonb_array_elements(COALESCE(r."body" -> 'content', '[]'::jsonb)) AS top_level(node)
			UNION ALL
			SELECT child.node
			FROM nested_nodes AS parent
			CROSS JOIN LATERAL jsonb_array_elements(
				CASE
					WHEN jsonb_typeof(parent.node -> 'content') = 'array'
					THEN parent.node -> 'content'
					ELSE '[]'::jsonb
				END
			) AS child(node)
		)
		SELECT 1
		FROM nested_nodes
		WHERE node ->> 'type' = 'image'
			AND NOT EXISTS (
				SELECT 1
				FROM "media_assets" AS embedded_media
				WHERE embedded_media."id"::text = node -> 'attrs' ->> 'mediaId'
					AND embedded_media."status" = 'ready'
			)
	);--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "article_media_references", "preview_media_references" FROM PUBLIC, nite_public;--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "article_media_references", "preview_media_references" TO nite_admin;--> statement-breakpoint
GRANT DELETE ON TABLE "articles", "media_assets" TO nite_admin;--> statement-breakpoint
GRANT SELECT ON TABLE "published_articles" TO nite_public, nite_admin;

DROP VIEW IF EXISTS "published_articles";--> statement-breakpoint
ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_ready_metadata_check";--> statement-breakpoint
ALTER TABLE "media_assets" DROP COLUMN "object_key";--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "staging_object_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "public_object_key" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_staging_object_key_unique" UNIQUE("staging_object_key");--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_public_object_key_unique" UNIQUE("public_object_key");--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_ready_metadata_check"
CHECK ("media_assets"."status" <> 'ready' or ("media_assets"."public_object_key" is not null and "media_assets"."checksum_sha256" is not null and "media_assets"."width" is not null and "media_assets"."height" is not null));--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_non_ready_public_key_check"
CHECK ("media_assets"."status" = 'ready' or "media_assets"."public_object_key" is null);--> statement-breakpoint
CREATE FUNCTION prevent_media_object_key_change() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF OLD."staging_object_key" IS DISTINCT FROM NEW."staging_object_key"
		OR (OLD."public_object_key" IS NOT NULL AND OLD."public_object_key" IS DISTINCT FROM NEW."public_object_key") THEN
		RAISE EXCEPTION 'as chaves de objeto de mídia são imutáveis';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER media_asset_object_keys_are_immutable
BEFORE UPDATE ON "media_assets"
FOR EACH ROW EXECUTE FUNCTION prevent_media_object_key_change();--> statement-breakpoint
REVOKE ALL ON FUNCTION prevent_media_object_key_change() FROM PUBLIC;--> statement-breakpoint
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
GRANT SELECT ON TABLE "published_articles" TO nite_public, nite_admin;

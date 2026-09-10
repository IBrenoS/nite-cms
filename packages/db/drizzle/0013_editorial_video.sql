DROP VIEW IF EXISTS "published_articles";--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video', 'captions');--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "media_kind" "media_kind" DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "video_codec" varchar(32);--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "has_audio" boolean;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "object_etag" varchar(255);--> statement-breakpoint
UPDATE "media_assets" SET "media_kind" = 'image' WHERE "media_kind" IS DISTINCT FROM 'image';--> statement-breakpoint
ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_ready_metadata_check";--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_duration_check"
CHECK ("media_assets"."duration_ms" is null or "media_assets"."duration_ms" > 0);--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_kind_metadata_check"
CHECK (
	("media_assets"."media_kind" = 'image'
		and "media_assets"."duration_ms" is null
		and "media_assets"."video_codec" is null
		and "media_assets"."has_audio" is null
		and "media_assets"."object_etag" is null)
	or ("media_assets"."media_kind" = 'video'
		and "media_assets"."checksum_sha256" is null)
	or ("media_assets"."media_kind" = 'captions'
		and "media_assets"."width" is null
		and "media_assets"."height" is null
		and "media_assets"."duration_ms" is null
		and "media_assets"."video_codec" is null
		and "media_assets"."has_audio" is null
		and "media_assets"."object_etag" is null)
);--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_ready_metadata_check"
CHECK (
	"media_assets"."status" <> 'ready'
	or (
		("media_assets"."media_kind" = 'image'
			and "media_assets"."public_object_key" is not null
			and "media_assets"."checksum_sha256" is not null
			and "media_assets"."width" is not null
			and "media_assets"."height" is not null)
		or ("media_assets"."media_kind" = 'video'
			and "media_assets"."mime_type" = 'video/mp4'
			and "media_assets"."public_object_key" is not null
			and "media_assets"."object_etag" is not null
			and "media_assets"."width" is not null
			and "media_assets"."height" is not null
			and "media_assets"."duration_ms" is not null
			and "media_assets"."video_codec" is not null
			and "media_assets"."has_audio" is not null)
		or ("media_assets"."media_kind" = 'captions'
			and "media_assets"."mime_type" = 'text/vtt'
			and "media_assets"."public_object_key" is not null
			and "media_assets"."checksum_sha256" is not null)
	)
);--> statement-breakpoint
ALTER TABLE "article_revisions" DROP CONSTRAINT "article_revisions_body_root_check";--> statement-breakpoint
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_body_root_check"
CHECK (
	COALESCE(
		("body" ->> 'schemaVersion') IN ('1', '2', '3')
		AND ("body" ->> 'type') = 'doc',
		false
	)
);--> statement-breakpoint
WITH revision_videos AS (
	SELECT revision."article_id", top_level.node
	FROM "article_revisions" AS revision
	CROSS JOIN LATERAL jsonb_array_elements(COALESCE(revision."body" -> 'content', '[]'::jsonb)) AS top_level(node)
	WHERE top_level.node ->> 'type' = 'video'
), revision_video_media(article_id, media_id) AS (
	SELECT "article_id", node -> 'attrs' ->> 'mediaId' FROM revision_videos
	UNION
	SELECT "article_id", node -> 'attrs' ->> 'captionsMediaId' FROM revision_videos
)
INSERT INTO "article_media_references" ("article_id", "media_id")
SELECT DISTINCT reference."article_id", media."id"
FROM revision_video_media AS reference
INNER JOIN "media_assets" AS media ON media."id"::text = reference."media_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH snapshot_videos AS (
	SELECT snapshot."id" AS snapshot_id, top_level.node
	FROM "preview_snapshots" AS snapshot
	CROSS JOIN LATERAL jsonb_array_elements(COALESCE(snapshot."payload" -> 'body' -> 'content', '[]'::jsonb)) AS top_level(node)
	WHERE top_level.node ->> 'type' = 'video'
), snapshot_video_media(snapshot_id, media_id) AS (
	SELECT snapshot_id, node -> 'attrs' ->> 'mediaId' FROM snapshot_videos
	UNION
	SELECT snapshot_id, node -> 'attrs' ->> 'captionsMediaId' FROM snapshot_videos
)
INSERT INTO "preview_media_references" ("snapshot_id", "media_id")
SELECT DISTINCT reference.snapshot_id, media."id"
FROM snapshot_video_media AS reference
INNER JOIN "media_assets" AS media ON media."id"::text = reference.media_id
ON CONFLICT DO NOTHING;--> statement-breakpoint
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
				jsonb_strip_nulls(jsonb_build_object(
					'mediaKind', embedded_media."media_kind",
					'objectKey', embedded_media."public_object_key",
					'mimeType', embedded_media."mime_type",
					'width', embedded_media."width",
					'height', embedded_media."height",
					'durationMs', embedded_media."duration_ms",
					'videoCodec', embedded_media."video_codec",
					'hasAudio', embedded_media."has_audio"
				))
			)
			FROM (
				WITH RECURSIVE nested_nodes(node) AS (
					SELECT top_level.node
					FROM jsonb_array_elements(COALESCE(r."body" -> 'content', '[]'::jsonb)) AS top_level(node)
					UNION ALL
					SELECT child.node
					FROM nested_nodes AS parent
					CROSS JOIN LATERAL jsonb_array_elements(
						CASE WHEN jsonb_typeof(parent.node -> 'content') = 'array'
						THEN parent.node -> 'content' ELSE '[]'::jsonb END
					) AS child(node)
				), referenced_media(media_id, expected_kind) AS (
					SELECT node -> 'attrs' ->> 'mediaId', 'image'::media_kind
					FROM nested_nodes WHERE node ->> 'type' = 'image'
					UNION
					SELECT node -> 'attrs' ->> 'mediaId', 'video'::media_kind
					FROM jsonb_array_elements(COALESCE(r."body" -> 'content', '[]'::jsonb)) AS top_level(node)
					WHERE node ->> 'type' = 'video'
					UNION
					SELECT node -> 'attrs' ->> 'captionsMediaId', 'captions'::media_kind
					FROM jsonb_array_elements(COALESCE(r."body" -> 'content', '[]'::jsonb)) AS top_level(node)
					WHERE node ->> 'type' = 'video' AND node -> 'attrs' ? 'captionsMediaId'
				)
				SELECT media_id, expected_kind FROM referenced_media
			) AS embedded_reference
			INNER JOIN "media_assets" AS embedded_media
				ON embedded_media."id"::text = embedded_reference.media_id
				AND embedded_media."media_kind" = embedded_reference.expected_kind
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
	AND m."media_kind" = 'image'
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
				CASE WHEN jsonb_typeof(parent.node -> 'content') = 'array'
				THEN parent.node -> 'content' ELSE '[]'::jsonb END
			) AS child(node)
		), referenced_media(media_id, expected_kind) AS (
			SELECT node -> 'attrs' ->> 'mediaId', 'image'::media_kind
			FROM nested_nodes WHERE node ->> 'type' = 'image'
			UNION
			SELECT node -> 'attrs' ->> 'mediaId', 'video'::media_kind
			FROM jsonb_array_elements(COALESCE(r."body" -> 'content', '[]'::jsonb)) AS top_level(node)
			WHERE node ->> 'type' = 'video'
			UNION
			SELECT node -> 'attrs' ->> 'captionsMediaId', 'captions'::media_kind
			FROM jsonb_array_elements(COALESCE(r."body" -> 'content', '[]'::jsonb)) AS top_level(node)
			WHERE node ->> 'type' = 'video' AND node -> 'attrs' ? 'captionsMediaId'
		)
		SELECT 1
		FROM referenced_media AS reference
		WHERE NOT EXISTS (
			SELECT 1 FROM "media_assets" AS embedded_media
			WHERE embedded_media."id"::text = reference.media_id
				AND embedded_media."media_kind" = reference.expected_kind
				AND embedded_media."status" = 'ready'
		)
	);--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "published_articles" FROM PUBLIC;--> statement-breakpoint
GRANT SELECT ON TABLE "published_articles" TO nite_public, nite_admin;

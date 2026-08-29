ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_body_root_check"
CHECK (
  COALESCE(
    ("body" ->> 'schemaVersion') = '1'
    AND ("body" ->> 'type') = 'doc',
    false
  )
);--> statement-breakpoint
DROP VIEW IF EXISTS "published_articles";--> statement-breakpoint
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
	m."object_key" AS "cover_object_key",
	r."cover_alt",
	r."body",
	COALESCE(
		(
			SELECT jsonb_object_agg(
				embedded_media."id"::text,
				jsonb_build_object(
					'objectKey', embedded_media."object_key",
					'width', embedded_media."width",
					'height', embedded_media."height"
				)
			)
			FROM jsonb_array_elements(r."body" -> 'content') AS node
			INNER JOIN "media_assets" AS embedded_media
				ON embedded_media."id"::text = node -> 'attrs' ->> 'mediaId'
				AND embedded_media."status" = 'ready'
			WHERE node ->> 'type' = 'image'
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
		SELECT 1
		FROM jsonb_array_elements(r."body" -> 'content') AS node
		WHERE node ->> 'type' = 'image'
			AND NOT EXISTS (
				SELECT 1
				FROM "media_assets" AS embedded_media
				WHERE embedded_media."id"::text = node -> 'attrs' ->> 'mediaId'
					AND embedded_media."status" = 'ready'
			)
	);--> statement-breakpoint
GRANT SELECT ON TABLE "published_articles" TO nite_public, nite_admin;

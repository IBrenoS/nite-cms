CREATE TYPE "public"."article_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."cms_role" AS ENUM('admin', 'editor', 'author');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'ready', 'quarantined', 'failed');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "article_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content_schema_version" integer DEFAULT 1 NOT NULL,
	"title" varchar(100) NOT NULL,
	"summary" varchar(220) NOT NULL,
	"category" varchar(32) NOT NULL,
	"event_date" date,
	"read_time_minutes" integer NOT NULL,
	"byline" varchar(80) NOT NULL,
	"cover_media_id" uuid,
	"cover_alt" text NOT NULL,
	"body" jsonb NOT NULL,
	"seo" jsonb,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_revisions_version_check" CHECK ("article_revisions"."version" >= 1),
	CONSTRAINT "article_revisions_schema_version_check" CHECK ("article_revisions"."content_schema_version" >= 1),
	CONSTRAINT "article_revisions_read_time_check" CHECK ("article_revisions"."read_time_minutes" between 1 and 30)
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"current_revision_id" uuid,
	"published_revision_id" uuid,
	"published_at" timestamp with time zone,
	"featured" boolean DEFAULT false NOT NULL,
	"created_by_membership_id" uuid,
	"updated_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug"),
	CONSTRAINT "articles_published_state_check" CHECK ("articles"."status" <> 'published' or ("articles"."published_revision_id" is not null and "articles"."published_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_membership_id" uuid,
	"action" varchar(80) NOT NULL,
	"aggregate_type" varchar(80) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"subject_id" varchar(128) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"email" varchar(320),
	"role" "cms_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" varchar(127) NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"checksum_sha256" varchar(64) NOT NULL,
	"status" "media_status" DEFAULT 'pending' NOT NULL,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "media_assets_byte_size_check" CHECK ("media_assets"."byte_size" >= 0),
	CONSTRAINT "media_assets_dimensions_check" CHECK (("media_assets"."width" is null or "media_assets"."width" > 0) and ("media_assets"."height" is null or "media_assets"."height" > 0))
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar(120) NOT NULL,
	"aggregate_id" uuid,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "outbox_events_attempts_check" CHECK ("outbox_events"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_cover_media_id_media_assets_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_created_by_membership_id_cms_memberships_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."cms_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_current_revision_id_article_revisions_id_fk" FOREIGN KEY ("current_revision_id") REFERENCES "public"."article_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_published_revision_id_article_revisions_id_fk" FOREIGN KEY ("published_revision_id") REFERENCES "public"."article_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_created_by_membership_id_cms_memberships_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."cms_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_updated_by_membership_id_cms_memberships_id_fk" FOREIGN KEY ("updated_by_membership_id") REFERENCES "public"."cms_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_membership_id_cms_memberships_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."cms_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_membership_id_cms_memberships_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."cms_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_revisions_article_version_unique" ON "article_revisions" USING btree ("article_id","version");--> statement-breakpoint
CREATE INDEX "article_revisions_article_idx" ON "article_revisions" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "articles_publication_idx" ON "articles" USING btree ("status","published_at","featured");--> statement-breakpoint
CREATE INDEX "audit_events_aggregate_idx" ON "audit_events" USING btree ("aggregate_type","aggregate_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_memberships_identity_unique" ON "cms_memberships" USING btree ("tenant_id","subject_id");--> statement-breakpoint
CREATE INDEX "cms_memberships_role_idx" ON "cms_memberships" USING btree ("role");--> statement-breakpoint
CREATE INDEX "media_assets_status_idx" ON "media_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events" USING btree ("status","next_attempt_at","created_at");--> statement-breakpoint
CREATE FUNCTION prevent_immutable_event_change() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION '% sao imutaveis', TG_TABLE_NAME;
END;
$$;--> statement-breakpoint
CREATE TRIGGER article_revisions_are_immutable
BEFORE UPDATE OR DELETE ON "article_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_event_change();--> statement-breakpoint
CREATE TRIGGER audit_events_are_immutable
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_event_change();--> statement-breakpoint
REVOKE ALL ON FUNCTION prevent_immutable_event_change() FROM PUBLIC;--> statement-breakpoint
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
	r."seo",
	true AS "public",
	'real'::text AS "content_state"
FROM "articles" a
INNER JOIN "article_revisions" r
	ON r."id" = a."published_revision_id"
	AND r."article_id" = a."id"
INNER JOIN "media_assets" m
	ON m."id" = r."cover_media_id"
	AND m."status" = 'ready'
WHERE a."status" = 'published'
	AND a."published_at" <= now();--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nite_admin') THEN
		CREATE ROLE nite_admin NOLOGIN;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nite_public') THEN
		CREATE ROLE nite_public NOLOGIN;
	END IF;
END;
$$;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO nite_admin, nite_public;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE
	"articles", "article_revisions", "media_assets", "cms_memberships",
	"audit_events", "outbox_events", "published_articles"
FROM PUBLIC;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE
	"articles", "article_revisions", "media_assets", "cms_memberships",
	"audit_events", "outbox_events"
FROM nite_public;--> statement-breakpoint
GRANT SELECT ON TABLE "published_articles" TO nite_public;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE
	"articles", "media_assets", "cms_memberships", "outbox_events"
TO nite_admin;--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "article_revisions", "audit_events"
TO nite_admin;--> statement-breakpoint
GRANT SELECT ON TABLE "published_articles" TO nite_admin;

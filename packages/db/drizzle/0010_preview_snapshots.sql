CREATE TABLE "preview_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"base_revision_id" uuid NOT NULL,
	"actor_membership_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preview_snapshots_expiration_check" CHECK ("preview_snapshots"."expires_at" > "preview_snapshots"."created_at")
);--> statement-breakpoint
ALTER TABLE "preview_snapshots" ADD CONSTRAINT "preview_snapshots_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_snapshots" ADD CONSTRAINT "preview_snapshots_base_revision_id_article_revisions_id_fk" FOREIGN KEY ("base_revision_id") REFERENCES "public"."article_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_snapshots" ADD CONSTRAINT "preview_snapshots_actor_membership_id_cms_memberships_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."cms_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "preview_snapshots_article_idx" ON "preview_snapshots" USING btree ("article_id", "created_at");--> statement-breakpoint
CREATE INDEX "preview_snapshots_expiration_idx" ON "preview_snapshots" USING btree ("expires_at");--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "preview_snapshots" FROM PUBLIC, nite_public;--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "preview_snapshots" TO nite_admin;

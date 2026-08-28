ALTER TABLE "article_revisions" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "article_revisions" AS revision
SET "featured" = article."featured"
FROM "articles" AS article
WHERE revision."id" = article."current_revision_id"
	OR revision."id" = article."published_revision_id";

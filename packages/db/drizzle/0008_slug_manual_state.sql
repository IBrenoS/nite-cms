ALTER TABLE "articles"
ADD COLUMN "slug_manually_edited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "articles"
SET "slug_manually_edited" = true;

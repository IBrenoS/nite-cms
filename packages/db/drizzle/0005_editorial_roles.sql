UPDATE "cms_memberships"
SET "active" = false
WHERE "role" = 'author';--> statement-breakpoint
ALTER TYPE "public"."cms_role" RENAME TO "cms_role_legacy";--> statement-breakpoint
CREATE TYPE "public"."cms_role" AS ENUM('admin', 'publisher');--> statement-breakpoint
ALTER TABLE "cms_memberships"
ALTER COLUMN "role" TYPE "public"."cms_role"
USING (
  CASE "role"::text
    WHEN 'admin' THEN 'admin'::"public"."cms_role"
    WHEN 'editor' THEN 'publisher'::"public"."cms_role"
    WHEN 'author' THEN 'publisher'::"public"."cms_role"
  END
);--> statement-breakpoint
DROP TYPE "public"."cms_role_legacy";

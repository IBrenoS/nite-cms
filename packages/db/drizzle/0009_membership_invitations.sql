CREATE TYPE "public"."cms_membership_invitation_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TABLE "cms_membership_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "cms_role" NOT NULL,
	"status" "cms_membership_invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by_membership_id" uuid NOT NULL,
	"accepted_membership_id" uuid,
	"replaces_invitation_id" uuid,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cms_membership_invitations_email_check" CHECK (
		"email" = lower(btrim("email"))
		and "email" ~ '^[a-z0-9.!#$%&''*+/=?^_{|}~-]+@unijorge[.]com$'
		and split_part("email", '@', 1) not like '.%'
		and split_part("email", '@', 1) not like '%.'
		and split_part("email", '@', 1) not like '%..%'
	),
	CONSTRAINT "cms_membership_invitations_expiration_check" CHECK ("expires_at" > "created_at"),
	CONSTRAINT "cms_membership_invitations_state_check" CHECK (
		("status" = 'pending' and "accepted_at" is null and "revoked_at" is null and "accepted_membership_id" is null)
		or ("status" = 'accepted' and "accepted_at" is not null and "revoked_at" is null and "accepted_membership_id" is not null)
		or ("status" = 'revoked' and "accepted_at" is null and "revoked_at" is not null and "accepted_membership_id" is null)
	)
);--> statement-breakpoint
ALTER TABLE "cms_membership_invitations" ADD CONSTRAINT "cms_membership_invitations_invited_by_membership_id_cms_memberships_id_fk" FOREIGN KEY ("invited_by_membership_id") REFERENCES "public"."cms_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_membership_invitations" ADD CONSTRAINT "cms_membership_invitations_accepted_membership_id_cms_memberships_id_fk" FOREIGN KEY ("accepted_membership_id") REFERENCES "public"."cms_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_membership_invitations" ADD CONSTRAINT "cms_membership_invitations_replaces_invitation_id_cms_membership_invitations_id_fk" FOREIGN KEY ("replaces_invitation_id") REFERENCES "public"."cms_membership_invitations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cms_membership_invitations_pending_email_unique" ON "cms_membership_invitations" USING btree ("tenant_id", "email") WHERE "status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "cms_membership_invitations_accepted_membership_unique" ON "cms_membership_invitations" USING btree ("accepted_membership_id") WHERE "accepted_membership_id" is not null;--> statement-breakpoint
CREATE INDEX "cms_membership_invitations_tenant_status_idx" ON "cms_membership_invitations" USING btree ("tenant_id", "status", "expires_at");--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "cms_membership_invitations" FROM PUBLIC, nite_public;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "cms_membership_invitations" TO nite_admin;

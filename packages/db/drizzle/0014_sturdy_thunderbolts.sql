ALTER TABLE "cms_membership_invitations" DROP CONSTRAINT "cms_membership_invitations_email_check";--> statement-breakpoint
ALTER TABLE "cms_membership_invitations" ADD CONSTRAINT "cms_membership_invitations_email_check" CHECK ("cms_membership_invitations"."email" = lower(btrim("cms_membership_invitations"."email"))
        and "cms_membership_invitations"."email" ~ '^[a-z0-9.!#$%&''*+/=?^_{|}~-]+@unijorge[.]com([.]br)?$'
        and split_part("cms_membership_invitations"."email", '@', 1) not like '.%'
        and split_part("cms_membership_invitations"."email", '@', 1) not like '%.'
        and split_part("cms_membership_invitations"."email", '@', 1) not like '%..%');
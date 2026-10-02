CREATE TYPE "public"."email_delivery_status" AS ENUM('pending', 'sent', 'delivered', 'bounced', 'complained', 'failed');--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outbox_event_id" uuid NOT NULL,
	"invitation_id" uuid NOT NULL,
	"provider" varchar(32) DEFAULT 'resend' NOT NULL,
	"provider_message_id" varchar(255),
	"recipient_email" varchar(320) NOT NULL,
	"status" "email_delivery_status" DEFAULT 'pending' NOT NULL,
	"last_provider_event_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_deliveries_provider_check" CHECK ("email_deliveries"."provider" = 'resend'),
	CONSTRAINT "email_deliveries_recipient_email_check" CHECK ("email_deliveries"."recipient_email" = lower(btrim("email_deliveries"."recipient_email")))
);
--> statement-breakpoint
CREATE TABLE "email_delivery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"delivery_id" uuid NOT NULL,
	"provider_event_type" varchar(80) NOT NULL,
	"provider_created_at" timestamp with time zone NOT NULL,
	"failure_reason" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cms_membership_invitations" ADD COLUMN "link_nonce" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_outbox_event_id_outbox_events_id_fk" FOREIGN KEY ("outbox_event_id") REFERENCES "public"."outbox_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_invitation_id_cms_membership_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."cms_membership_invitations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_delivery_events" ADD CONSTRAINT "email_delivery_events_delivery_id_email_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."email_deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_outbox_event_unique" ON "email_deliveries" USING btree ("outbox_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_invitation_unique" ON "email_deliveries" USING btree ("invitation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_provider_message_unique" ON "email_deliveries" USING btree ("provider_message_id") WHERE "email_deliveries"."provider_message_id" is not null;--> statement-breakpoint
CREATE INDEX "email_deliveries_status_idx" ON "email_deliveries" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_delivery_events_provider_event_unique" ON "email_delivery_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "email_delivery_events_delivery_created_idx" ON "email_delivery_events" USING btree ("delivery_id","provider_created_at");--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE "email_deliveries", "email_delivery_events" FROM PUBLIC, nite_public;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "email_deliveries", "email_delivery_events" TO nite_admin;

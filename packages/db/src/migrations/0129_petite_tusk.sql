CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid,
	"recipient_email" varchar(255) NOT NULL,
	"template" varchar(100) NOT NULL,
	"channel" varchar(20) DEFAULT 'email' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"dedup_key" varchar(500) NOT NULL,
	"locked_by" varchar(100),
	"locked_until" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_message_id" varchar(255),
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_outbox_status_check" CHECK ("email_outbox"."status" IN ('pending', 'processing', 'sent', 'failed', 'retry')),
	CONSTRAINT "email_outbox_processing_lease_check" CHECK ("email_outbox"."status" <> 'processing' OR ("email_outbox"."locked_by" IS NOT NULL AND "email_outbox"."locked_until" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_outbox_dedup_key_uidx" ON "email_outbox" USING btree ("dedup_key");--> statement-breakpoint
CREATE INDEX "email_outbox_status_locked_until_idx" ON "email_outbox" USING btree ("status","locked_until");--> statement-breakpoint
CREATE INDEX "email_outbox_recipient_user_idx" ON "email_outbox" USING btree ("recipient_user_id");
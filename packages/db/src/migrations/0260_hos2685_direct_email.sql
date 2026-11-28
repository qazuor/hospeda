CREATE TYPE "public"."direct_email_recipient_status_enum" AS ENUM('sent', 'failed', 'suppressed', 'delivered', 'opened', 'bounced');--> statement-breakpoint
CREATE TYPE "public"."direct_email_suppression_reason_enum" AS ENUM('opt_out', 'hard_bounce', 'manual');--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'DIRECT_EMAIL';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'directEmail.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'directEmail.send';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'directEmail.template.write';--> statement-breakpoint
CREATE TABLE "direct_email_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body_json" jsonb NOT NULL,
	"template_id" uuid,
	"sent_by" uuid NOT NULL,
	"from_email" text NOT NULL,
	"reply_to_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "direct_email_recipient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"email" varchar(254) NOT NULL,
	"status" "direct_email_recipient_status_enum" NOT NULL,
	"provider_message_id" varchar(255),
	"error_message" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"bounced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "direct_email_suppression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"reason" "direct_email_suppression_reason_enum" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "direct_email_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body_json" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "direct_email_message" ADD CONSTRAINT "direct_email_message_template_id_direct_email_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."direct_email_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_email_message" ADD CONSTRAINT "direct_email_message_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_email_recipient" ADD CONSTRAINT "direct_email_recipient_message_id_direct_email_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."direct_email_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_email_suppression" ADD CONSTRAINT "direct_email_suppression_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_email_template" ADD CONSTRAINT "direct_email_template_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_email_template" ADD CONSTRAINT "direct_email_template_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "direct_email_message_created_at_idx" ON "direct_email_message" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "direct_email_message_sent_by_idx" ON "direct_email_message" USING btree ("sent_by");--> statement-breakpoint
CREATE INDEX "direct_email_recipient_message_idx" ON "direct_email_recipient" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "direct_email_recipient_provider_message_id_idx" ON "direct_email_recipient" USING btree ("provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "direct_email_suppression_email_uidx" ON "direct_email_suppression" USING btree ("email");--> statement-breakpoint
CREATE INDEX "direct_email_template_deleted_at_idx" ON "direct_email_template" USING btree ("deleted_at");
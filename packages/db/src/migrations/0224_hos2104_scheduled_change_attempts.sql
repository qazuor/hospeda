ALTER TABLE "subscription_scheduled_change" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_scheduled_change" ADD COLUMN "last_error_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_scheduled_change" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "subscription_scheduled_change" ADD CONSTRAINT "ck_subscription_scheduled_change_attempt_count_nonnegative" CHECK ("subscription_scheduled_change"."attempt_count" >= 0);
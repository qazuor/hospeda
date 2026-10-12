ALTER TYPE "public"."permission_enum" ADD VALUE 'listing.moderate' BEFORE 'billing.subscription.inspect';--> statement-breakpoint
ALTER TABLE "domain_event" DROP CONSTRAINT "domain_event_event_type_check";--> statement-breakpoint
ALTER TABLE "accommodation_media" ADD COLUMN "remote_deletion_pending_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accommodation_calendar_sync" ADD COLUMN "remote_deletion_pending_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "experience_media" ADD COLUMN "remote_deletion_pending_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gastronomy_media" ADD COLUMN "remote_deletion_pending_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "domain_event" ADD CONSTRAINT "domain_event_event_type_check" CHECK ("domain_event"."event_type" IN ('email.undeliverable', 'listing.created', 'listing.edited', 'listing.status_changed', 'listing.fix_request_opened', 'listing.fix_request_closed', 'trial.extended', 'reconciliation.mark_opened'));

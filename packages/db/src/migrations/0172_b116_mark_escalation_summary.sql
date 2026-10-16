CREATE TABLE "reconciliation_summary_window" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"covers_from" timestamp with time zone NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"window_minutes" integer NOT NULL,
	"deadlines_version" integer NOT NULL,
	"sent_at" timestamp with time zone,
	"event_count" integer,
	CONSTRAINT "ck_reconciliation_summary_window_minutes_positive" CHECK ("reconciliation_summary_window"."window_minutes" > 0),
	CONSTRAINT "ck_reconciliation_summary_window_closes_after_open" CHECK ("reconciliation_summary_window"."closes_at" > "reconciliation_summary_window"."opened_at"),
	CONSTRAINT "ck_reconciliation_summary_window_sent_pair" CHECK (("reconciliation_summary_window"."sent_at" IS NULL) = ("reconciliation_summary_window"."event_count" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "domain_event" DROP CONSTRAINT "domain_event_event_type_check";--> statement-breakpoint
ALTER TABLE "reconciliation_mark" ADD COLUMN "deadlines_version" integer;--> statement-breakpoint
ALTER TABLE "reconciliation_mark" ADD COLUMN "escalated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reconciliation_summary_window" ADD CONSTRAINT "reconciliation_summary_window_deadlines_version_billing_deadline_version_version_fk" FOREIGN KEY ("deadlines_version") REFERENCES "public"."billing_deadline_version"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reconciliation_summary_window_covers_from" ON "reconciliation_summary_window" USING btree ("covers_from");--> statement-breakpoint
CREATE INDEX "ix_reconciliation_summary_window_open" ON "reconciliation_summary_window" USING btree ("closes_at") WHERE "reconciliation_summary_window"."sent_at" IS NULL;--> statement-breakpoint
ALTER TABLE "reconciliation_mark" ADD CONSTRAINT "reconciliation_mark_deadlines_version_billing_deadline_version_version_fk" FOREIGN KEY ("deadlines_version") REFERENCES "public"."billing_deadline_version"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_reconciliation_mark_open_unescalated" ON "reconciliation_mark" USING btree ("placed_at") WHERE "reconciliation_mark"."lifted_at" IS NULL AND "reconciliation_mark"."escalated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "domain_event" ADD CONSTRAINT "domain_event_event_type_check" CHECK ("domain_event"."event_type" IN ('email.undeliverable', 'listing.created', 'listing.edited', 'listing.status_changed', 'listing.fix_request_opened', 'listing.fix_request_closed', 'trial.extended', 'reconciliation.mark_opened', 'account.closed_on_request', 'partner_application.email_replaced', 'subscription.provider_cancellation_decided', 'subscription.provider_cancelled_after_rejection', 'reconciliation.mark_escalated', 'reconciliation.undercharge_detected', 'reconciliation.pause_gift_detected'));
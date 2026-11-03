ALTER TABLE "reconciliation_sweep_run" ADD COLUMN "cycle_id" uuid;--> statement-breakpoint
ALTER TABLE "reconciliation_sweep_run" ADD COLUMN "cycle_date" date;--> statement-breakpoint
ALTER TABLE "reconciliation_sweep_run" ADD COLUMN "cycle_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reconciliation_sweep_run" ADD COLUMN "slice_index" smallint;--> statement-breakpoint
ALTER TABLE "reconciliation_sweep_run" ADD COLUMN "phase" varchar(16);--> statement-breakpoint
ALTER TABLE "reconciliation_sweep_run" ADD COLUMN "rows_complete" boolean;--> statement-breakpoint
ALTER TABLE "reconciliation_sweep_run" ADD COLUMN "passes_completed" text[];--> statement-breakpoint
ALTER TABLE "reconciliation_sweep_run" ADD COLUMN "lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reconciliation_sweep_run" ADD COLUMN "outcome" varchar(32);--> statement-breakpoint
ALTER TABLE "reconciliation_sweep_run" ADD COLUMN "failed_subscription_ids" uuid[];--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "last_swept_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reconciliation_sweep_run_cycle_slice" ON "reconciliation_sweep_run" USING btree ("cycle_id","slice_index") WHERE "reconciliation_sweep_run"."cycle_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_reconciliation_sweep_run_open" ON "reconciliation_sweep_run" USING btree ("lease_until") WHERE "reconciliation_sweep_run"."outcome" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_subscription_last_swept_at" ON "subscription" USING btree ("last_swept_at" NULLS FIRST,"id");
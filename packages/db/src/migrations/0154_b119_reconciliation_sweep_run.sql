CREATE TABLE "reconciliation_sweep_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"correlation_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"rows_read" integer DEFAULT 0 NOT NULL,
	"rows_failed" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ck_reconciliation_sweep_run_counts" CHECK ("reconciliation_sweep_run"."rows_read" >= 0 AND "reconciliation_sweep_run"."rows_failed" >= 0),
	CONSTRAINT "ck_reconciliation_sweep_run_span" CHECK ("reconciliation_sweep_run"."finished_at" IS NULL OR "reconciliation_sweep_run"."finished_at" >= "reconciliation_sweep_run"."started_at")
);
--> statement-breakpoint
CREATE INDEX "idx_reconciliation_sweep_run_started_at" ON "reconciliation_sweep_run" USING btree ("started_at" DESC NULLS LAST);
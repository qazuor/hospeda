CREATE TABLE "provider_watch_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account" varchar(16) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"outcome" varchar(16) NOT NULL,
	"reason" text,
	"measurements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"alerts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "ck_provider_watch_run_account" CHECK ("provider_watch_run"."account" IN ('sandbox', 'production')),
	CONSTRAINT "ck_provider_watch_run_outcome" CHECK ("provider_watch_run"."outcome" IN ('completed', 'failed', 'aborted', 'refused')),
	CONSTRAINT "ck_provider_watch_run_span" CHECK ("provider_watch_run"."finished_at" >= "provider_watch_run"."started_at")
);
--> statement-breakpoint
CREATE INDEX "idx_provider_watch_run_completed" ON "provider_watch_run" USING btree ("account","finished_at" DESC NULLS LAST) WHERE "provider_watch_run"."outcome" = 'completed';
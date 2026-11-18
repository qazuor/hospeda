ALTER TYPE "public"."permission_enum" ADD VALUE 'billing.providerWatch.manage' BEFORE 'billing.cancelSubscription';--> statement-breakpoint
CREATE TABLE "provider_watch_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account" varchar(16) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"outcome" varchar(16) NOT NULL,
	"reason" text,
	"measurements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ledger" jsonb DEFAULT '{"charged":0,"refunded":0}'::jsonb NOT NULL,
	"alerts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "ck_provider_watch_run_account" CHECK ("provider_watch_run"."account" IN ('sandbox', 'production')),
	CONSTRAINT "ck_provider_watch_run_outcome" CHECK ("provider_watch_run"."outcome" IN ('running', 'completed', 'failed', 'aborted', 'refused')),
	CONSTRAINT "ck_provider_watch_run_span" CHECK ("provider_watch_run"."finished_at" IS NULL OR "provider_watch_run"."finished_at" >= "provider_watch_run"."started_at")
);
--> statement-breakpoint
CREATE TABLE "provider_watch_shape_baseline" (
	"account" varchar(16) NOT NULL,
	"measurement_id" varchar(16) NOT NULL,
	"shapes" jsonb NOT NULL,
	"source_run_id" uuid NOT NULL,
	"accepted_by" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_watch_shape_baseline_account_measurement_id_pk" PRIMARY KEY("account","measurement_id"),
	CONSTRAINT "ck_provider_watch_shape_baseline_account" CHECK ("provider_watch_shape_baseline"."account" IN ('sandbox', 'production'))
);
--> statement-breakpoint
ALTER TABLE "provider_watch_shape_baseline" ADD CONSTRAINT "provider_watch_shape_baseline_source_run_id_provider_watch_run_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."provider_watch_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_watch_shape_baseline" ADD CONSTRAINT "provider_watch_shape_baseline_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_provider_watch_run_completed" ON "provider_watch_run" USING btree ("account","finished_at" DESC NULLS LAST) WHERE "provider_watch_run"."outcome" = 'completed';
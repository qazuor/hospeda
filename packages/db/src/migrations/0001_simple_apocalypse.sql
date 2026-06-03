CREATE TABLE "app_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" varchar(10) NOT NULL,
	"category" varchar(50),
	"label" text,
	"message" text NOT NULL,
	"data" jsonb,
	"logged_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "appLogEntries_level_logged_idx" ON "app_log_entries" USING btree ("level","logged_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "appLogEntries_category_logged_idx" ON "app_log_entries" USING btree ("category","logged_at" DESC NULLS LAST);
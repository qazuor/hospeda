ALTER TABLE "app_log_entries" ADD COLUMN "request_id" varchar(64);--> statement-breakpoint
ALTER TABLE "app_log_entries" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "app_log_entries" ADD COLUMN "method" varchar(10);--> statement-breakpoint
ALTER TABLE "app_log_entries" ADD COLUMN "path" text;--> statement-breakpoint
CREATE INDEX "appLogEntries_userId_logged_idx" ON "app_log_entries" USING btree ("user_id","logged_at" DESC NULLS LAST);
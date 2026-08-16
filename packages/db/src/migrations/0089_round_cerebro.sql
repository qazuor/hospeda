ALTER TABLE "alliance_leads" ADD COLUMN "ops_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "commerce_leads" ADD COLUMN "ops_notified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "alliance_leads_ops_notified_at_idx" ON "alliance_leads" USING btree ("ops_notified_at");--> statement-breakpoint
CREATE INDEX "commerce_leads_opsNotifiedAt_idx" ON "commerce_leads" USING btree ("ops_notified_at");
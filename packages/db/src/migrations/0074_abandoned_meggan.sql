ALTER TABLE "alliance_leads" ADD COLUMN "applicant_user_id" uuid;--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD COLUMN "claim_token" text;--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD COLUMN "claim_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD CONSTRAINT "alliance_leads_applicant_user_id_users_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alliance_leads_applicant_user_id_idx" ON "alliance_leads" USING btree ("applicant_user_id");
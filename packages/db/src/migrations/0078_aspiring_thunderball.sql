ALTER TABLE "partners" ALTER COLUMN "starts_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD COLUMN "provisioned_partner_id" uuid;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD CONSTRAINT "alliance_leads_provisioned_partner_id_partners_id_fk" FOREIGN KEY ("provisioned_partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partners_ownerUserId_idx" ON "partners" USING btree ("owner_user_id");
CREATE TYPE "public"."host_trade_benefit_type_enum" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT', 'TWO_FOR_ONE', 'SPECIAL_CONDITION');--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD COLUMN "business_name" varchar(255);--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD COLUMN "category" varchar(50);--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD COLUMN "destination_id" uuid;--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD COLUMN "benefit_type" varchar(30);--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD COLUMN "benefit_value" integer;--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD COLUMN "benefit_text" text;--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD COLUMN "provisioned_host_trade_id" uuid;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "benefit_type" "host_trade_benefit_type_enum";--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "benefit_value" integer;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "pending_benefit_type" "host_trade_benefit_type_enum";--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "pending_benefit_value" integer;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "pending_benefit_text" text;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "benefit_review_state" varchar(20);--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "revoked_by_id" uuid;--> statement-breakpoint
ALTER TABLE "host_trades" ADD COLUMN "revoke_reason" text;--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD CONSTRAINT "alliance_leads_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD CONSTRAINT "alliance_leads_provisioned_host_trade_id_host_trades_id_fk" FOREIGN KEY ("provisioned_host_trade_id") REFERENCES "public"."host_trades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trades" ADD CONSTRAINT "host_trades_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trades" ADD CONSTRAINT "host_trades_revoked_by_id_users_id_fk" FOREIGN KEY ("revoked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hostTrades_ownerUserId_idx" ON "host_trades" USING btree ("owner_user_id");
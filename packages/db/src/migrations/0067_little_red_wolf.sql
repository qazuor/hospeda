CREATE TABLE "alliance_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(30) NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" varchar(50),
	"message" text NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD CONSTRAINT "alliance_leads_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD CONSTRAINT "alliance_leads_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_leads" ADD CONSTRAINT "alliance_leads_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alliance_leads_kind_idx" ON "alliance_leads" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "alliance_leads_status_idx" ON "alliance_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alliance_leads_email_idx" ON "alliance_leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "alliance_leads_deletedAt_idx" ON "alliance_leads" USING btree ("deleted_at");
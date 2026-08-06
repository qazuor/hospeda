ALTER TABLE "partners" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "revoked_by_id" uuid;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "revoke_reason" text;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_revoked_by_id_users_id_fk" FOREIGN KEY ("revoked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
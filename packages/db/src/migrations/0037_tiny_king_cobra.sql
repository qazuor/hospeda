ALTER TYPE "public"."permission_enum" ADD VALUE 'accommodation.verify' BEFORE 'accommodation.visibility.change';--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "verified_by_id" uuid;--> statement-breakpoint
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accommodations_isVerified_idx" ON "accommodations" USING btree ("is_verified");
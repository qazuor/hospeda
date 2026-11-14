ALTER TABLE "accommodations" ADD COLUMN "location_key" text;--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "location_exception_by" uuid;--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "location_exception_reason" text;--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "location_exception_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "location_key" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "location_exception_by" uuid;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "location_exception_reason" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "location_exception_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_location_exception_by_users_id_fk" FOREIGN KEY ("location_exception_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_location_exception_by_users_id_fk" FOREIGN KEY ("location_exception_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accommodations_locationKey_idx" ON "accommodations" USING btree ("location_key") WHERE "accommodations"."location_key" IS NOT NULL AND "accommodations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "venues_locationKey_idx" ON "venues" USING btree ("location_key") WHERE "venues"."location_key" IS NOT NULL AND "venues"."deleted_at" IS NULL;
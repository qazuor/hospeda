ALTER TABLE "r_experience_amenity" ADD COLUMN "is_optional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "r_experience_amenity" ADD COLUMN "additional_cost" jsonb;--> statement-breakpoint
ALTER TABLE "r_experience_amenity" ADD COLUMN "additional_cost_percent" double precision;--> statement-breakpoint
ALTER TABLE "r_experience_amenity" ADD COLUMN "scope" "amenity_scope_enum";--> statement-breakpoint
ALTER TABLE "r_experience_amenity" ADD COLUMN "availability" "amenity_availability_enum";--> statement-breakpoint
ALTER TABLE "r_venue_amenity" ADD COLUMN "is_optional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "r_venue_amenity" ADD COLUMN "additional_cost" jsonb;--> statement-breakpoint
ALTER TABLE "r_venue_amenity" ADD COLUMN "additional_cost_percent" double precision;--> statement-breakpoint
ALTER TABLE "r_venue_amenity" ADD COLUMN "scope" "amenity_scope_enum";--> statement-breakpoint
ALTER TABLE "r_venue_amenity" ADD COLUMN "availability" "amenity_availability_enum";
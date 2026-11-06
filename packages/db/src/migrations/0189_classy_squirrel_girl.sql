CREATE TYPE "public"."amenity_availability_enum" AS ENUM('year_round', 'seasonal');--> statement-breakpoint
CREATE TYPE "public"."amenity_scope_enum" AS ENUM('private', 'shared');--> statement-breakpoint
CREATE TYPE "public"."feature_category_enum" AS ENUM('LOCATION', 'VIEW', 'ACCESS', 'STYLE', 'AUDIENCE', 'OFFER_PROFILE', 'SUSTAINABILITY', 'ACTIVITIES', 'CUISINE', 'DIETARY', 'LANGUAGE');--> statement-breakpoint
ALTER TYPE "public"."amenities_type_enum" ADD VALUE 'PARKING';--> statement-breakpoint
ALTER TYPE "public"."amenities_type_enum" ADD VALUE 'LAUNDRY';--> statement-breakpoint
ALTER TYPE "public"."amenities_type_enum" ADD VALUE 'WATER_ACTIVITIES';--> statement-breakpoint
ALTER TYPE "public"."amenities_type_enum" ADD VALUE 'WELLNESS';--> statement-breakpoint
ALTER TYPE "public"."amenities_type_enum" ADD VALUE 'DINING';--> statement-breakpoint
ALTER TABLE "features" ADD COLUMN "category" "feature_category_enum";--> statement-breakpoint
ALTER TABLE "r_accommodation_amenity" ADD COLUMN "scope" "amenity_scope_enum";--> statement-breakpoint
ALTER TABLE "r_accommodation_amenity" ADD COLUMN "availability" "amenity_availability_enum";
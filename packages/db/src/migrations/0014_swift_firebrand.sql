ALTER TYPE "public"."permission_category_enum" ADD VALUE 'BILLING' BEFORE 'PUBLIC';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'amenity.view' BEFORE 'amenity.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'feature.view' BEFORE 'feature.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'tag.view' BEFORE 'tag.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'billing.readAll';--> statement-breakpoint
ALTER TABLE "amenities" ADD COLUMN "display_weight" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "features" ADD COLUMN "display_weight" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "attractions" ADD COLUMN "display_weight" integer DEFAULT 50 NOT NULL;
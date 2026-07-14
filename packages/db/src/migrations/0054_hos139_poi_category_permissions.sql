ALTER TYPE "public"."permission_category_enum" ADD VALUE 'POI_CATEGORY' BEFORE 'POST';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'poiCategory.create' BEFORE 'clientAccessRight.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'poiCategory.update' BEFORE 'clientAccessRight.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'poiCategory.delete' BEFORE 'clientAccessRight.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'poiCategory.view' BEFORE 'clientAccessRight.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'poiCategory.restore' BEFORE 'clientAccessRight.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'poiCategory.hardDelete' BEFORE 'clientAccessRight.create';
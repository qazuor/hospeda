ALTER TYPE "public"."permission_category_enum" ADD VALUE 'GASTRONOMY' BEFORE 'HOST_TRADE';--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'EXPERIENCE' BEFORE 'HOST_TRADE';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'gastronomy.editOwn' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'gastronomy.create' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'gastronomy.viewAll' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'gastronomy.editAll' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'gastronomy.delete' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'gastronomy.moderateReview' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'gastronomy.moderationChange' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'experience.editOwn' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'experience.create' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'experience.viewAll' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'experience.editAll' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'experience.delete' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'experience.moderateReview' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'experience.moderationChange' BEFORE 'partner.create';--> statement-breakpoint
ALTER TYPE "public"."role_enum" ADD VALUE 'GASTRONOMY_OWNER' BEFORE 'SPONSOR';--> statement-breakpoint
ALTER TYPE "public"."role_enum" ADD VALUE 'EXPERIENCE_OWNER' BEFORE 'SPONSOR';
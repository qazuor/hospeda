ALTER TYPE "public"."permission_enum" ADD VALUE 'listing.foreignContent.edit' BEFORE 'user.update.self';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'billing.subscription.inspect' BEFORE 'user.update.self';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'billing.viewOwn' BEFORE 'user.update.self';
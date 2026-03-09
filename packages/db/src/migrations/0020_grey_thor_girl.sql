ALTER TYPE "public"."permission_enum" ADD VALUE 'billing.promoCode.read';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'billing.promoCode.manage';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'billing.metrics.read';--> statement-breakpoint
CREATE UNIQUE INDEX "accommodation_reviews_user_accommodation_uniq" ON "accommodation_reviews" USING btree ("user_id","accommodation_id");
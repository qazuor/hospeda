ALTER TABLE "experience_faqs" ADD COLUMN "is_visible_on_listing" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "experience_faqs" ADD COLUMN "is_usable_by_ai" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "gastronomy_faqs" ADD COLUMN "is_visible_on_listing" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "gastronomy_faqs" ADD COLUMN "is_usable_by_ai" boolean DEFAULT true NOT NULL;
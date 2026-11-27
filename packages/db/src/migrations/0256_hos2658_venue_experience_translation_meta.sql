ALTER TABLE "experiences" ADD COLUMN "translation_meta" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "translation_meta" jsonb DEFAULT '{}'::jsonb;
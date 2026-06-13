ALTER TABLE "accommodations" ADD COLUMN "name_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "summary_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "description_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "rich_description_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "translation_meta" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "name_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "summary_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "description_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "translation_meta" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "name_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "summary_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "description_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "translation_meta" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "title_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "summary_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "content_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "translation_meta" jsonb DEFAULT '{}'::jsonb;

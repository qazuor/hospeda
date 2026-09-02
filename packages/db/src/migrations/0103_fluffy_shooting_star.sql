ALTER TABLE "experiences" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "what_to_bring" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "requirements" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "cancellation_policy" text;--> statement-breakpoint
ALTER TABLE "experiences" ADD COLUMN "accepts_private_groups" boolean DEFAULT false NOT NULL;
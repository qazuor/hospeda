CREATE TYPE "public"."external_platform_enum" AS ENUM('GOOGLE', 'BOOKING', 'AIRBNB', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."external_reputation_fetch_status_enum" AS ENUM('ok', 'blocked', 'not_found', 'error');--> statement-breakpoint
CREATE TABLE "accommodation_external_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accommodation_id" uuid NOT NULL,
	"platform" "external_platform_enum" NOT NULL,
	"url" text NOT NULL,
	"external_id" text,
	"show_link" boolean DEFAULT false NOT NULL,
	"show_reviews" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accommodation_external_reputation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accommodation_id" uuid NOT NULL,
	"platform" "external_platform_enum" NOT NULL,
	"listing_id" uuid NOT NULL,
	"rating" numeric(3, 2),
	"reviews_count" integer,
	"deep_link" text,
	"snippets" jsonb,
	"snippets_fetched_at" timestamp with time zone,
	"aggregate_fetched_at" timestamp with time zone,
	"fetch_status" "external_reputation_fetch_status_enum" DEFAULT 'ok' NOT NULL,
	"fetch_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accommodations" ADD COLUMN "show_external_reputation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accommodation_external_listings" ADD CONSTRAINT "accommodation_external_listings_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_external_listings" ADD CONSTRAINT "accommodation_external_listings_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_external_listings" ADD CONSTRAINT "accommodation_external_listings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_external_listings" ADD CONSTRAINT "accommodation_external_listings_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_external_reputation" ADD CONSTRAINT "accommodation_external_reputation_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_external_reputation" ADD CONSTRAINT "accommodation_external_reputation_listing_id_accommodation_external_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."accommodation_external_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accommodation_external_listings_accommodationId_idx" ON "accommodation_external_listings" USING btree ("accommodation_id");--> statement-breakpoint
CREATE INDEX "accommodation_external_listings_platform_idx" ON "accommodation_external_listings" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "accommodation_external_listings_deletedAt_idx" ON "accommodation_external_listings" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "accommodation_external_listings_accommodation_platform_uniq" ON "accommodation_external_listings" USING btree ("accommodation_id","platform");--> statement-breakpoint
CREATE INDEX "accommodation_external_reputation_accommodationId_idx" ON "accommodation_external_reputation" USING btree ("accommodation_id");--> statement-breakpoint
CREATE INDEX "accommodation_external_reputation_listingId_idx" ON "accommodation_external_reputation" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "accommodation_external_reputation_platform_idx" ON "accommodation_external_reputation" USING btree ("platform");--> statement-breakpoint
CREATE UNIQUE INDEX "accommodation_external_reputation_accommodation_platform_uniq" ON "accommodation_external_reputation" USING btree ("accommodation_id","platform");
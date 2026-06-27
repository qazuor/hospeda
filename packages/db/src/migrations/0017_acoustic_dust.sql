CREATE TYPE "public"."gastronomy_type_enum" AS ENUM('RESTAURANT', 'BAR', 'CAFE', 'PARRILLA', 'CERVECERIA', 'HELADERIA', 'PANADERIA', 'ROTISERIA', 'FOOD_TRUCK');--> statement-breakpoint
CREATE TYPE "public"."price_range_enum" AS ENUM('BUDGET', 'MID', 'HIGH', 'PREMIUM');--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'COMMERCE' BEFORE 'HOST_TRADE';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.schedule.editOwn' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.contact.editOwn' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.social.editOwn' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.media.editOwn' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.menu.editOwn' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.priceRange.editOwn' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.richDescription.editOwn' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.amenities.editOwn' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.features.editOwn' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.faqs.editOwn' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.create' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.viewAll' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.editAll' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.delete' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'commerce.moderateReview' BEFORE 'hostTrade.view';--> statement-breakpoint
ALTER TYPE "public"."role_enum" ADD VALUE 'COMMERCE_OWNER' BEFORE 'SPONSOR';--> statement-breakpoint
CREATE TABLE "commerce_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(50) NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" varchar(50),
	"destination_id" uuid,
	"message" text,
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"handled_at" timestamp with time zone,
	"handled_by_id" uuid,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce_listing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"product_domain" varchar(50) DEFAULT 'commerce' NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"status" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gastronomies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"description" text NOT NULL,
	"rich_description" text,
	"name_i18n" jsonb,
	"summary_i18n" jsonb,
	"description_i18n" jsonb,
	"rich_description_i18n" jsonb,
	"type" "gastronomy_type_enum" NOT NULL,
	"price_range" "price_range_enum",
	"menu_url" text,
	"contact_info" jsonb,
	"social_networks" jsonb,
	"opening_hours" jsonb,
	"media" jsonb,
	"seo" jsonb,
	"admin_info" jsonb,
	"owner_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"visibility" "visibility_enum" DEFAULT 'PUBLIC' NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"moderation_state" "moderation_status_enum" DEFAULT 'PENDING' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"reviews_count" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2) DEFAULT 0 NOT NULL,
	"rating" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "gastronomies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gastronomy_faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gastronomy_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" text,
	"display_order" integer,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "gastronomy_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gastronomy_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"content" text,
	"rating" jsonb NOT NULL,
	"average_rating" numeric(3, 2) DEFAULT 0 NOT NULL,
	"overall_rating" numeric(3, 2) DEFAULT 0 NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"moderation_state" "moderation_status_enum" DEFAULT 'PENDING' NOT NULL,
	"moderated_by_id" uuid,
	"moderated_at" timestamp with time zone,
	"moderation_reason" text
);
--> statement-breakpoint
CREATE TABLE "r_gastronomy_amenity" (
	"gastronomy_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	CONSTRAINT "r_gastronomy_amenity_gastronomy_id_amenity_id_pk" PRIMARY KEY("gastronomy_id","amenity_id")
);
--> statement-breakpoint
CREATE TABLE "r_gastronomy_feature" (
	"gastronomy_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	"host_rewrite_name" text,
	"comments" text,
	CONSTRAINT "r_gastronomy_feature_gastronomy_id_feature_id_pk" PRIMARY KEY("gastronomy_id","feature_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "commerce_leads" ADD CONSTRAINT "commerce_leads_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_leads" ADD CONSTRAINT "commerce_leads_handled_by_id_users_id_fk" FOREIGN KEY ("handled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_listing_subscriptions" ADD CONSTRAINT "commerce_listing_subscriptions_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomies" ADD CONSTRAINT "gastronomies_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomies" ADD CONSTRAINT "gastronomies_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomies" ADD CONSTRAINT "gastronomies_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomies" ADD CONSTRAINT "gastronomies_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomies" ADD CONSTRAINT "gastronomies_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_faqs" ADD CONSTRAINT "gastronomy_faqs_gastronomy_id_gastronomies_id_fk" FOREIGN KEY ("gastronomy_id") REFERENCES "public"."gastronomies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_faqs" ADD CONSTRAINT "gastronomy_faqs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_faqs" ADD CONSTRAINT "gastronomy_faqs_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_faqs" ADD CONSTRAINT "gastronomy_faqs_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_reviews" ADD CONSTRAINT "gastronomy_reviews_gastronomy_id_gastronomies_id_fk" FOREIGN KEY ("gastronomy_id") REFERENCES "public"."gastronomies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_reviews" ADD CONSTRAINT "gastronomy_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_reviews" ADD CONSTRAINT "gastronomy_reviews_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_reviews" ADD CONSTRAINT "gastronomy_reviews_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_reviews" ADD CONSTRAINT "gastronomy_reviews_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_reviews" ADD CONSTRAINT "gastronomy_reviews_moderated_by_id_users_id_fk" FOREIGN KEY ("moderated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_gastronomy_amenity" ADD CONSTRAINT "r_gastronomy_amenity_gastronomy_id_gastronomies_id_fk" FOREIGN KEY ("gastronomy_id") REFERENCES "public"."gastronomies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_gastronomy_amenity" ADD CONSTRAINT "r_gastronomy_amenity_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_gastronomy_feature" ADD CONSTRAINT "r_gastronomy_feature_gastronomy_id_gastronomies_id_fk" FOREIGN KEY ("gastronomy_id") REFERENCES "public"."gastronomies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_gastronomy_feature" ADD CONSTRAINT "r_gastronomy_feature_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commerce_leads_status_idx" ON "commerce_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commerce_leads_email_idx" ON "commerce_leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "commerce_leads_destinationId_idx" ON "commerce_leads" USING btree ("destination_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_listing_subs_entity_uniq" ON "commerce_listing_subscriptions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "commerce_listing_subs_entityId_idx" ON "commerce_listing_subscriptions" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "commerce_listing_subs_status_idx" ON "commerce_listing_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gastronomies_destinationId_idx" ON "gastronomies" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "gastronomies_visibility_idx" ON "gastronomies" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "gastronomies_isFeatured_idx" ON "gastronomies" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "gastronomies_type_idx" ON "gastronomies" USING btree ("type");--> statement-breakpoint
CREATE INDEX "gastronomies_ownerId_idx" ON "gastronomies" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "gastronomies_deletedAt_idx" ON "gastronomies" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "gastronomies_moderationState_idx" ON "gastronomies" USING btree ("moderation_state");--> statement-breakpoint
CREATE INDEX "gastronomies_destinationId_visibility_idx" ON "gastronomies" USING btree ("destination_id","visibility");--> statement-breakpoint
CREATE INDEX "gastronomies_ownerId_deletedAt_idx" ON "gastronomies" USING btree ("owner_id","deleted_at");--> statement-breakpoint
CREATE INDEX "gastronomyFaqs_gastronomyId_idx" ON "gastronomy_faqs" USING btree ("gastronomy_id");--> statement-breakpoint
CREATE INDEX "gastronomyFaqs_category_idx" ON "gastronomy_faqs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "gastronomy_reviews_gastronomyId_idx" ON "gastronomy_reviews" USING btree ("gastronomy_id");--> statement-breakpoint
CREATE INDEX "gastronomy_reviews_userId_idx" ON "gastronomy_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gastronomy_reviews_user_gastronomy_uniq" ON "gastronomy_reviews" USING btree ("user_id","gastronomy_id");--> statement-breakpoint
CREATE INDEX "gastronomy_reviews_lifecycleState_idx" ON "gastronomy_reviews" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "gastronomy_reviews_gastronomyId_lifecycleState_idx" ON "gastronomy_reviews" USING btree ("gastronomy_id","lifecycle_state");--> statement-breakpoint
CREATE INDEX "gastronomy_reviews_moderationState_idx" ON "gastronomy_reviews" USING btree ("moderation_state");--> statement-breakpoint
CREATE INDEX "r_gastronomy_amenity_gastronomyId_amenityId_idx" ON "r_gastronomy_amenity" USING btree ("gastronomy_id","amenity_id");--> statement-breakpoint
CREATE INDEX "r_gastronomy_amenity_amenityId_idx" ON "r_gastronomy_amenity" USING btree ("amenity_id");--> statement-breakpoint
CREATE INDEX "r_gastronomy_feature_gastronomyId_featureId_idx" ON "r_gastronomy_feature" USING btree ("gastronomy_id","feature_id");--> statement-breakpoint
CREATE INDEX "r_gastronomy_feature_featureId_idx" ON "r_gastronomy_feature" USING btree ("feature_id");
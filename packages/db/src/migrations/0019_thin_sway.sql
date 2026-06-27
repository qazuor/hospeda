CREATE TYPE "public"."experience_price_unit_enum" AS ENUM('per_day', 'per_hour', 'per_person', 'per_group');--> statement-breakpoint
CREATE TYPE "public"."experience_type_enum" AS ENUM('CAR_RENTAL', 'BIKE_RENTAL', 'KAYAK_RENTAL', 'QUAD_RENTAL', 'TOUR_GUIDE', 'GUIDED_VISIT', 'EXCURSION', 'BOAT_TRIP', 'FISHING_CHARTER', 'BIRD_WATCHING', 'CULTURAL_TOUR', 'WINE_TASTING', 'OUTDOOR_ADVENTURE', 'OTHER');--> statement-breakpoint
CREATE TABLE "experiences" (
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
	"type" "experience_type_enum" NOT NULL,
	"price_from" integer DEFAULT 0 NOT NULL,
	"price_unit" "experience_price_unit_enum" NOT NULL,
	"is_price_on_request" boolean DEFAULT false NOT NULL,
	"has_active_subscription" boolean DEFAULT false NOT NULL,
	"contact_info" jsonb,
	"social_networks" jsonb,
	"opening_hours" jsonb,
	"media" jsonb,
	"seo" jsonb,
	"admin_info" jsonb,
	"owner_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"visibility" "visibility_enum" DEFAULT 'PUBLIC' NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'DRAFT' NOT NULL,
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
	CONSTRAINT "experiences_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "experience_faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid NOT NULL,
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
CREATE TABLE "experience_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid NOT NULL,
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
CREATE TABLE "r_experience_amenity" (
	"experience_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	CONSTRAINT "r_experience_amenity_experience_id_amenity_id_pk" PRIMARY KEY("experience_id","amenity_id")
);
--> statement-breakpoint
CREATE TABLE "r_experience_feature" (
	"experience_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	"host_rewrite_name" text,
	"comments" text,
	CONSTRAINT "r_experience_feature_experience_id_feature_id_pk" PRIMARY KEY("experience_id","feature_id")
);
--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_faqs" ADD CONSTRAINT "experience_faqs_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_faqs" ADD CONSTRAINT "experience_faqs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_faqs" ADD CONSTRAINT "experience_faqs_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_faqs" ADD CONSTRAINT "experience_faqs_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_reviews" ADD CONSTRAINT "experience_reviews_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_reviews" ADD CONSTRAINT "experience_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_reviews" ADD CONSTRAINT "experience_reviews_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_reviews" ADD CONSTRAINT "experience_reviews_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_reviews" ADD CONSTRAINT "experience_reviews_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_reviews" ADD CONSTRAINT "experience_reviews_moderated_by_id_users_id_fk" FOREIGN KEY ("moderated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_experience_amenity" ADD CONSTRAINT "r_experience_amenity_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_experience_amenity" ADD CONSTRAINT "r_experience_amenity_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_experience_feature" ADD CONSTRAINT "r_experience_feature_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_experience_feature" ADD CONSTRAINT "r_experience_feature_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experiences_destinationId_idx" ON "experiences" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "experiences_visibility_idx" ON "experiences" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "experiences_isFeatured_idx" ON "experiences" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "experiences_type_idx" ON "experiences" USING btree ("type");--> statement-breakpoint
CREATE INDEX "experiences_ownerId_idx" ON "experiences" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "experiences_deletedAt_idx" ON "experiences" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "experiences_moderationState_idx" ON "experiences" USING btree ("moderation_state");--> statement-breakpoint
CREATE INDEX "experiences_hasActiveSubscription_lifecycleState_idx" ON "experiences" USING btree ("has_active_subscription","lifecycle_state");--> statement-breakpoint
CREATE INDEX "experiences_ownerId_deletedAt_idx" ON "experiences" USING btree ("owner_id","deleted_at");--> statement-breakpoint
CREATE INDEX "experiences_destinationId_visibility_idx" ON "experiences" USING btree ("destination_id","visibility");--> statement-breakpoint
CREATE INDEX "experienceFaqs_experienceId_idx" ON "experience_faqs" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "experienceFaqs_category_idx" ON "experience_faqs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "experience_reviews_experienceId_idx" ON "experience_reviews" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "experience_reviews_userId_idx" ON "experience_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "experience_reviews_user_experience_uniq" ON "experience_reviews" USING btree ("user_id","experience_id");--> statement-breakpoint
CREATE INDEX "experience_reviews_lifecycleState_idx" ON "experience_reviews" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "experience_reviews_experienceId_lifecycleState_idx" ON "experience_reviews" USING btree ("experience_id","lifecycle_state");--> statement-breakpoint
CREATE INDEX "experience_reviews_moderationState_idx" ON "experience_reviews" USING btree ("moderation_state");--> statement-breakpoint
CREATE INDEX "r_experience_amenity_experienceId_amenityId_idx" ON "r_experience_amenity" USING btree ("experience_id","amenity_id");--> statement-breakpoint
CREATE INDEX "r_experience_amenity_amenityId_idx" ON "r_experience_amenity" USING btree ("amenity_id");--> statement-breakpoint
CREATE INDEX "r_experience_feature_experienceId_featureId_idx" ON "r_experience_feature" USING btree ("experience_id","feature_id");--> statement-breakpoint
CREATE INDEX "r_experience_feature_featureId_idx" ON "r_experience_feature" USING btree ("feature_id");
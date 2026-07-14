CREATE TABLE "poi_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_i18n" jsonb NOT NULL,
	"translation_meta" jsonb DEFAULT '{}'::jsonb,
	"icon" text,
	"display_weight" integer DEFAULT 50 NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "poi_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "r_poi_category" (
	"point_of_interest_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "r_poi_category_point_of_interest_id_category_id_pk" PRIMARY KEY("point_of_interest_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "poi_categories" ADD CONSTRAINT "poi_categories_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poi_categories" ADD CONSTRAINT "poi_categories_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poi_categories" ADD CONSTRAINT "poi_categories_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_poi_category" ADD CONSTRAINT "r_poi_category_point_of_interest_id_points_of_interest_id_fk" FOREIGN KEY ("point_of_interest_id") REFERENCES "public"."points_of_interest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_poi_category" ADD CONSTRAINT "r_poi_category_category_id_poi_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."poi_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "poiCategories_slug_idx" ON "poi_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "poiCategories_lifecycleState_idx" ON "poi_categories" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "pointOfInterestId_categoryId_idx" ON "r_poi_category" USING btree ("point_of_interest_id","category_id");--> statement-breakpoint
CREATE INDEX "r_poi_category_categoryId_idx" ON "r_poi_category" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "r_poi_category_primary_idx" ON "r_poi_category" USING btree ("point_of_interest_id") WHERE is_primary = true;
CREATE TYPE "public"."point_of_interest_type_enum" AS ENUM('BEACH', 'STADIUM', 'PARK', 'MUSEUM', 'PLAZA', 'MONUMENT', 'VIEWPOINT', 'NATURAL', 'OTHER');--> statement-breakpoint
ALTER TYPE "public"."permission_category_enum" ADD VALUE 'POINT_OF_INTEREST' BEFORE 'POST';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'destination.pointOfInterest.manage' BEFORE 'event.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'pointOfInterest.create' BEFORE 'clientAccessRight.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'pointOfInterest.update' BEFORE 'clientAccessRight.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'pointOfInterest.delete' BEFORE 'clientAccessRight.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'pointOfInterest.view' BEFORE 'clientAccessRight.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'pointOfInterest.restore' BEFORE 'clientAccessRight.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'pointOfInterest.lifecycle.change' BEFORE 'clientAccessRight.create';--> statement-breakpoint
ALTER TYPE "public"."permission_enum" ADD VALUE 'pointOfInterest.hardDelete' BEFORE 'clientAccessRight.create';--> statement-breakpoint
CREATE TABLE "points_of_interest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"lat" double precision NOT NULL,
	"long" double precision NOT NULL,
	"type" "point_of_interest_type_enum" NOT NULL,
	"icon" text,
	"description" text,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"display_weight" integer DEFAULT 50 NOT NULL,
	"lifecycle_state" "lifecycle_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"admin_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "points_of_interest_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "r_destination_point_of_interest" (
	"destination_id" uuid NOT NULL,
	"point_of_interest_id" uuid NOT NULL,
	CONSTRAINT "r_destination_point_of_interest_destination_id_point_of_interest_id_pk" PRIMARY KEY("destination_id","point_of_interest_id")
);
--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD CONSTRAINT "points_of_interest_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD CONSTRAINT "points_of_interest_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD CONSTRAINT "points_of_interest_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_destination_point_of_interest" ADD CONSTRAINT "r_destination_point_of_interest_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_destination_point_of_interest" ADD CONSTRAINT "r_destination_point_of_interest_point_of_interest_id_points_of_interest_id_fk" FOREIGN KEY ("point_of_interest_id") REFERENCES "public"."points_of_interest"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pointsOfInterest_slug_idx" ON "points_of_interest" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "pointsOfInterest_isFeatured_idx" ON "points_of_interest" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "pointsOfInterest_lifecycleState_idx" ON "points_of_interest" USING btree ("lifecycle_state");--> statement-breakpoint
CREATE INDEX "pointsOfInterest_type_idx" ON "points_of_interest" USING btree ("type");--> statement-breakpoint
CREATE INDEX "destinationId_pointOfInterestId_idx" ON "r_destination_point_of_interest" USING btree ("destination_id","point_of_interest_id");--> statement-breakpoint
CREATE INDEX "r_destination_point_of_interest_pointOfInterestId_idx" ON "r_destination_point_of_interest" USING btree ("point_of_interest_id");
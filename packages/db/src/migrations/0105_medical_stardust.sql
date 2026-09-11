CREATE TYPE "public"."gastronomy_menu_file_kind_enum" AS ENUM('image', 'pdf');--> statement-breakpoint
CREATE TABLE "gastronomy_menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"gastronomy_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer,
	"is_available" boolean DEFAULT true NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "gastronomy_menu_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gastronomy_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "gastronomies" ADD COLUMN "menu_file_url" text;--> statement-breakpoint
ALTER TABLE "gastronomies" ADD COLUMN "menu_file_public_id" text;--> statement-breakpoint
ALTER TABLE "gastronomies" ADD COLUMN "menu_file_kind" "gastronomy_menu_file_kind_enum";--> statement-breakpoint
ALTER TABLE "gastronomy_menu_items" ADD CONSTRAINT "gastronomy_menu_items_section_id_gastronomy_menu_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."gastronomy_menu_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_menu_items" ADD CONSTRAINT "gastronomy_menu_items_gastronomy_id_gastronomies_id_fk" FOREIGN KEY ("gastronomy_id") REFERENCES "public"."gastronomies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_menu_items" ADD CONSTRAINT "gastronomy_menu_items_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_menu_items" ADD CONSTRAINT "gastronomy_menu_items_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_menu_sections" ADD CONSTRAINT "gastronomy_menu_sections_gastronomy_id_gastronomies_id_fk" FOREIGN KEY ("gastronomy_id") REFERENCES "public"."gastronomies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_menu_sections" ADD CONSTRAINT "gastronomy_menu_sections_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_menu_sections" ADD CONSTRAINT "gastronomy_menu_sections_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gastronomyMenuItems_sectionId_idx" ON "gastronomy_menu_items" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "gastronomyMenuItems_gastronomyId_idx" ON "gastronomy_menu_items" USING btree ("gastronomy_id");--> statement-breakpoint
CREATE INDEX "gastronomyMenuItems_sectionId_displayOrder_idx" ON "gastronomy_menu_items" USING btree ("section_id","display_order");--> statement-breakpoint
CREATE INDEX "gastronomyMenuSections_gastronomyId_idx" ON "gastronomy_menu_sections" USING btree ("gastronomy_id");--> statement-breakpoint
CREATE INDEX "gastronomyMenuSections_gastronomyId_displayOrder_idx" ON "gastronomy_menu_sections" USING btree ("gastronomy_id","display_order");
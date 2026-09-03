CREATE TABLE "gastronomy_daily_specials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gastronomy_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"price_cents" integer,
	"valid_from" date NOT NULL,
	"valid_until" date NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "gastronomy_daily_specials" ADD CONSTRAINT "gastronomy_daily_specials_gastronomy_id_gastronomies_id_fk" FOREIGN KEY ("gastronomy_id") REFERENCES "public"."gastronomies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_daily_specials" ADD CONSTRAINT "gastronomy_daily_specials_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastronomy_daily_specials" ADD CONSTRAINT "gastronomy_daily_specials_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gastronomyDailySpecials_gastronomyId_idx" ON "gastronomy_daily_specials" USING btree ("gastronomy_id");--> statement-breakpoint
CREATE INDEX "gastronomyDailySpecials_gastronomyId_validity_idx" ON "gastronomy_daily_specials" USING btree ("gastronomy_id","valid_from","valid_until");
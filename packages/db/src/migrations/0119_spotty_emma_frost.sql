CREATE TYPE "public"."partner_logo_click_destination_enum" AS ENUM('OWN_PAGE', 'EXTERNAL');--> statement-breakpoint
CREATE TABLE "entity_view_monthly_rollups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type_enum" NOT NULL,
	"entity_id" uuid NOT NULL,
	"month" date NOT NULL,
	"total" integer NOT NULL,
	"unique_visitors" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_logo_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"visitor_hash" text NOT NULL,
	"destination" "partner_logo_click_destination_enum" NOT NULL,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_logo_click_monthly_rollups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"month" date NOT NULL,
	"total" integer NOT NULL,
	"unique_visitors" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_logo_clicks" ADD CONSTRAINT "partner_logo_clicks_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_logo_click_monthly_rollups" ADD CONSTRAINT "partner_logo_click_monthly_rollups_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entityViewMonthlyRollups_entity_month_uq" ON "entity_view_monthly_rollups" USING btree ("entity_type","entity_id","month");--> statement-breakpoint
CREATE INDEX "partnerLogoClicks_partnerId_clickedAt_idx" ON "partner_logo_clicks" USING btree ("partner_id","clicked_at");--> statement-breakpoint
CREATE INDEX "partnerLogoClicks_clickedAt_idx" ON "partner_logo_clicks" USING btree ("clicked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partnerLogoClickMonthlyRollups_partner_month_uq" ON "partner_logo_click_monthly_rollups" USING btree ("partner_id","month");
CREATE TABLE "tourist_price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"accommodation_id" uuid NOT NULL,
	"base_price_snapshot" integer NOT NULL,
	"target_percent_drop" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tourist_price_alerts" ADD CONSTRAINT "tourist_price_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tourist_price_alerts" ADD CONSTRAINT "tourist_price_alerts_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "touristPriceAlerts_userId_idx" ON "tourist_price_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "touristPriceAlerts_accommodationId_idx" ON "tourist_price_alerts" USING btree ("accommodation_id");--> statement-breakpoint
CREATE INDEX "touristPriceAlerts_isActive_idx" ON "tourist_price_alerts" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tourist_price_alerts_user_accommodation_active_unique" ON "tourist_price_alerts" USING btree ("user_id","accommodation_id") WHERE deleted_at IS NULL;
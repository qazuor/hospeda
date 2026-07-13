CREATE TYPE "public"."calendar_sync_status_enum" AS ENUM('PENDING', 'OK', 'ERROR');--> statement-breakpoint
CREATE TABLE "accommodation_calendar_sync" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accommodation_id" uuid NOT NULL,
	"provider" "occupancy_source_enum" NOT NULL,
	"external_calendar_id" varchar(255),
	"sync_token" text,
	"last_sync_at" timestamp with time zone,
	"last_sync_status" "calendar_sync_status_enum" DEFAULT 'PENDING' NOT NULL,
	"last_error_message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"access_token_ciphertext" text NOT NULL,
	"access_token_iv" varchar(64) NOT NULL,
	"access_token_auth_tag" varchar(64) NOT NULL,
	"refresh_token_ciphertext" text,
	"refresh_token_iv" varchar(64),
	"refresh_token_auth_tag" varchar(64),
	"token_scope" text,
	"token_expires_at" timestamp with time zone,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accommodation_calendar_sync" ADD CONSTRAINT "accommodation_calendar_sync_accommodation_id_accommodations_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accommodation_calendar_sync" ADD CONSTRAINT "accommodation_calendar_sync_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accommodationCalendarSync_accommodationId_provider_uq" ON "accommodation_calendar_sync" USING btree ("accommodation_id","provider");
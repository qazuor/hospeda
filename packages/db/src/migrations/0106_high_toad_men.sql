CREATE TYPE "public"."qr_code_source_enum" AS ENUM('MANUAL', 'GENERATED');--> statement-breakpoint
ALTER TYPE "public"."entity_type_enum" ADD VALUE 'HOST_TRADE';--> statement-breakpoint
CREATE TABLE "qr_code_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qr_code_id" uuid NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"target_url" text NOT NULL,
	"label" varchar(200) NOT NULL,
	"description" text,
	"source" "qr_code_source_enum" NOT NULL,
	"entity_type" "entity_type_enum",
	"entity_id" uuid,
	"render_options" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "qr_code_scans" ADD CONSTRAINT "qr_code_scans_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "qrCodeScans_qrCodeId_idx" ON "qr_code_scans" USING btree ("qr_code_id");--> statement-breakpoint
CREATE INDEX "qrCodeScans_scannedAt_idx" ON "qr_code_scans" USING btree ("scanned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "qrCodes_slug_unique" ON "qr_codes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "qrCodes_entity_idx" ON "qr_codes" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "qrCodes_isActive_idx" ON "qr_codes" USING btree ("is_active");
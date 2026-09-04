CREATE TYPE "public"."qr_scan_device_type_enum" AS ENUM('MOBILE', 'TABLET', 'DESKTOP');--> statement-breakpoint
CREATE TYPE "public"."qr_scan_os_enum" AS ENUM('IOS', 'ANDROID', 'OTHER');--> statement-breakpoint
ALTER TABLE "qr_code_scans" ADD COLUMN "user_agent" varchar(1024);--> statement-breakpoint
ALTER TABLE "qr_code_scans" ADD COLUMN "device_type" "qr_scan_device_type_enum";--> statement-breakpoint
ALTER TABLE "qr_code_scans" ADD COLUMN "os" "qr_scan_os_enum";--> statement-breakpoint
ALTER TABLE "qr_code_scans" ADD COLUMN "browser_language" varchar(8);--> statement-breakpoint
ALTER TABLE "qr_code_scans" ADD COLUMN "target_url_at_scan" text;--> statement-breakpoint
ALTER TABLE "qr_code_scans" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "qr_code_scans" ADD CONSTRAINT "qr_code_scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "qrCodeScans_userId_idx" ON "qr_code_scans" USING btree ("user_id");
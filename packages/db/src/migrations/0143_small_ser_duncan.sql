CREATE TABLE "cuota_ventana" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"vertical" varchar(32) NOT NULL,
	"key" varchar(64) NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"consumed" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "uq_cuota_ventana_user_vertical_key_opens" UNIQUE("user_id","vertical","key","opens_at"),
	CONSTRAINT "ck_cuota_ventana_closes_after_opens" CHECK ("cuota_ventana"."closes_at" > "cuota_ventana"."opens_at"),
	CONSTRAINT "ck_cuota_ventana_consumed_nonnegative" CHECK ("cuota_ventana"."consumed" >= 0)
);
--> statement-breakpoint
ALTER TABLE "cuota_ventana" ADD CONSTRAINT "cuota_ventana_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuota_ventana" ADD CONSTRAINT "cuota_ventana_vertical_vertical_id_fk" FOREIGN KEY ("vertical") REFERENCES "public"."vertical"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuota_ventana" ADD CONSTRAINT "cuota_ventana_key_catalog_key_key_fk" FOREIGN KEY ("key") REFERENCES "public"."catalog_key"("key") ON DELETE no action ON UPDATE no action;
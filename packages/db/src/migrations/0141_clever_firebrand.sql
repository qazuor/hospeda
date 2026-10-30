ALTER TABLE "addon_product" ADD COLUMN "addon_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "addon_version" ADD CONSTRAINT "uq_addon_version_id_addon" UNIQUE("id","addon_id");--> statement-breakpoint
ALTER TABLE "addon_product" ADD CONSTRAINT "addon_product_addon_id_addon_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addon"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_product" ADD CONSTRAINT "fk_addon_product_version_addon" FOREIGN KEY ("version_id","addon_id") REFERENCES "public"."addon_version"("id","addon_id") ON DELETE no action ON UPDATE no action;

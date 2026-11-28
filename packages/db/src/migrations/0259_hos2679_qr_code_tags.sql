CREATE TABLE "qr_code_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"color" "tag_color_enum",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "r_qr_code_qr_code_tag" (
	"qr_code_id" uuid NOT NULL,
	"qr_code_tag_id" uuid NOT NULL,
	CONSTRAINT "r_qr_code_qr_code_tag_qr_code_id_qr_code_tag_id_pk" PRIMARY KEY("qr_code_id","qr_code_tag_id")
);
--> statement-breakpoint
ALTER TABLE "qr_code_tags" ADD CONSTRAINT "qr_code_tags_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_code_tags" ADD CONSTRAINT "qr_code_tags_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_code_tags" ADD CONSTRAINT "qr_code_tags_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_qr_code_qr_code_tag" ADD CONSTRAINT "r_qr_code_qr_code_tag_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r_qr_code_qr_code_tag" ADD CONSTRAINT "r_qr_code_qr_code_tag_qr_code_tag_id_qr_code_tags_id_fk" FOREIGN KEY ("qr_code_tag_id") REFERENCES "public"."qr_code_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "qrCodeTags_slug_live_unique" ON "qr_code_tags" USING btree ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "r_qr_code_qr_code_tag_qrCodeTagId_idx" ON "r_qr_code_qr_code_tag" USING btree ("qr_code_tag_id");
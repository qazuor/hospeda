CREATE TABLE "permanent_grant_vertical" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"permanent_grant_id" uuid NOT NULL,
	"vertical" varchar(32) NOT NULL,
	"plan_id" uuid NOT NULL,
	"floor_plan_version_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_permanent_grant_vertical_grant_vertical" UNIQUE("permanent_grant_id","vertical")
);
--> statement-breakpoint
CREATE TABLE "permanent_grant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"beneficiary_user_id" uuid NOT NULL,
	"includes_addons" boolean NOT NULL,
	"granted_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"affected_subscription_ids" uuid[] DEFAULT '{}' NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revocation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_permanent_grant_revocation_together" CHECK (("permanent_grant"."revoked_at" IS NULL AND "permanent_grant"."revoked_by" IS NULL AND "permanent_grant"."revocation_reason" IS NULL) OR ("permanent_grant"."revoked_at" IS NOT NULL AND "permanent_grant"."revoked_by" IS NOT NULL AND "permanent_grant"."revocation_reason" IS NOT NULL AND btrim("permanent_grant"."revocation_reason") <> ''))
);
--> statement-breakpoint
ALTER TABLE "addon_instance" ADD COLUMN "title_anchor_id" uuid;--> statement-breakpoint
ALTER TABLE "permanent_grant_vertical" ADD CONSTRAINT "permanent_grant_vertical_permanent_grant_id_permanent_grant_id_fk" FOREIGN KEY ("permanent_grant_id") REFERENCES "public"."permanent_grant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permanent_grant_vertical" ADD CONSTRAINT "fk_permanent_grant_vertical_plan" FOREIGN KEY ("plan_id","vertical") REFERENCES "public"."plan"("id","vertical") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permanent_grant_vertical" ADD CONSTRAINT "fk_permanent_grant_vertical_floor" FOREIGN KEY ("floor_plan_version_id","plan_id") REFERENCES "public"."plan_version"("id","plan_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permanent_grant" ADD CONSTRAINT "permanent_grant_beneficiary_user_id_users_id_fk" FOREIGN KEY ("beneficiary_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permanent_grant" ADD CONSTRAINT "permanent_grant_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permanent_grant" ADD CONSTRAINT "permanent_grant_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_permanent_grant_live_beneficiary" ON "permanent_grant" USING btree ("beneficiary_user_id") WHERE revoked_at IS NULL;--> statement-breakpoint
ALTER TABLE "addon_instance" ADD CONSTRAINT "addon_instance_title_anchor_id_permanent_grant_vertical_id_fk" FOREIGN KEY ("title_anchor_id") REFERENCES "public"."permanent_grant_vertical"("id") ON DELETE no action ON UPDATE no action;
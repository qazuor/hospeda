CREATE TABLE "addon_version_entitlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"addon_version_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_addon_version_entitlement_version_key" UNIQUE("addon_version_id","key")
);
--> statement-breakpoint
CREATE TABLE "addon_version_limit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"addon_version_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_addon_version_limit_version_key" UNIQUE("addon_version_id","key"),
	CONSTRAINT "ck_addon_version_limit_value" CHECK ("addon_version_limit"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "addon_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"addon_id" uuid NOT NULL,
	"validity" varchar(32) NOT NULL,
	"validity_days" integer,
	"scope_type" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_addon_version_validity" CHECK ("addon_version"."validity" IN ('FIXED_DAYS', 'WHILE_SUBSCRIPTION_ALIVE')),
	CONSTRAINT "ck_addon_version_scope_type" CHECK ("addon_version"."scope_type" IN ('LISTING', 'VERTICAL_SUBSCRIPTION', 'USER', 'GLOBAL')),
	CONSTRAINT "ck_addon_version_validity_days" CHECK (("addon_version"."validity" = 'FIXED_DAYS') = ("addon_version"."validity_days" IS NOT NULL) AND ("addon_version"."validity_days" IS NULL OR "addon_version"."validity_days" > 0))
);
--> statement-breakpoint
CREATE TABLE "addon" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_addon_slug" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "plan_version_entitlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"plan_quota" integer,
	"trial_quota" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_plan_version_entitlement_version_key" UNIQUE("plan_version_id","key"),
	CONSTRAINT "ck_plan_version_entitlement_quotas_together" CHECK (("plan_version_entitlement"."plan_quota" IS NULL) = ("plan_version_entitlement"."trial_quota" IS NULL)),
	CONSTRAINT "ck_plan_version_entitlement_quotas_non_negative" CHECK ("plan_version_entitlement"."plan_quota" IS NULL OR ("plan_version_entitlement"."plan_quota" >= 0 AND "plan_version_entitlement"."trial_quota" >= 0))
);
--> statement-breakpoint
CREATE TABLE "plan_version_limit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_plan_version_limit_version_key" UNIQUE("plan_version_id","key"),
	CONSTRAINT "ck_plan_version_limit_value" CHECK ("plan_version_limit"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "plan_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"vertical" varchar(32) NOT NULL,
	"rank" integer NOT NULL,
	"sellable" boolean NOT NULL,
	"current" boolean NOT NULL,
	"grace_days" integer DEFAULT 10 NOT NULL,
	"trial_days" integer NOT NULL,
	"allows_pause" boolean NOT NULL,
	"inherits_tourist_vip" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_plan_version_id_plan" UNIQUE("id","plan_id"),
	CONSTRAINT "uq_plan_version_id_vertical" UNIQUE("id","vertical"),
	CONSTRAINT "ck_plan_version_grace_days" CHECK ("plan_version"."grace_days" >= 0),
	CONSTRAINT "ck_plan_version_trial_days" CHECK ("plan_version"."trial_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vertical" varchar(32) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"pricing_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_plan_vertical_slug" UNIQUE("vertical","slug"),
	CONSTRAINT "uq_plan_id_vertical" UNIQUE("id","vertical")
);
--> statement-breakpoint
ALTER TABLE "addon_version_entitlement" ADD CONSTRAINT "addon_version_entitlement_addon_version_id_addon_version_id_fk" FOREIGN KEY ("addon_version_id") REFERENCES "public"."addon_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_version_entitlement" ADD CONSTRAINT "addon_version_entitlement_key_catalog_key_key_fk" FOREIGN KEY ("key") REFERENCES "public"."catalog_key"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_version_limit" ADD CONSTRAINT "addon_version_limit_addon_version_id_addon_version_id_fk" FOREIGN KEY ("addon_version_id") REFERENCES "public"."addon_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_version_limit" ADD CONSTRAINT "addon_version_limit_key_catalog_key_key_fk" FOREIGN KEY ("key") REFERENCES "public"."catalog_key"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_version" ADD CONSTRAINT "addon_version_addon_id_addon_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addon"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version_entitlement" ADD CONSTRAINT "plan_version_entitlement_plan_version_id_plan_version_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version_entitlement" ADD CONSTRAINT "plan_version_entitlement_key_catalog_key_key_fk" FOREIGN KEY ("key") REFERENCES "public"."catalog_key"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version_limit" ADD CONSTRAINT "plan_version_limit_plan_version_id_plan_version_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version_limit" ADD CONSTRAINT "plan_version_limit_key_catalog_key_key_fk" FOREIGN KEY ("key") REFERENCES "public"."catalog_key"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "fk_plan_version_plan_vertical" FOREIGN KEY ("plan_id","vertical") REFERENCES "public"."plan"("id","vertical") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_vertical_vertical_id_fk" FOREIGN KEY ("vertical") REFERENCES "public"."vertical"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_plan_version_one_current_per_plan" ON "plan_version" USING btree ("plan_id") WHERE "plan_version"."current";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_plan_version_sellable_current_rank" ON "plan_version" USING btree ("vertical","rank") WHERE "plan_version"."sellable" AND "plan_version"."current";
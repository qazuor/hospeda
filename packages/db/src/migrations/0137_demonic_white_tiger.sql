CREATE TABLE "canje_de_trial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"vertical" varchar(32) NOT NULL,
	"redemption_key" varchar(255) NOT NULL,
	"applied_days" integer NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_canje_de_trial_redemption_key" UNIQUE("redemption_key"),
	CONSTRAINT "ck_canje_de_trial_applied_days" CHECK ("canje_de_trial"."applied_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "trial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"vertical" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"trial_plan_id" uuid,
	"floor_entitlements_version_id" uuid,
	"floor_limits_version_id" uuid,
	"floor_trial_plan_version_id" uuid,
	"started_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"email_pseudonym" varchar(64) NOT NULL,
	"deadlines_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_trial_user_vertical" UNIQUE("user_id","vertical"),
	CONSTRAINT "uq_trial_email_pseudonym_vertical" UNIQUE("email_pseudonym","vertical"),
	CONSTRAINT "ck_trial_status" CHECK ("trial"."status" IN ('TRIAL_ACTIVE', 'TRIAL_EXPIRED', 'TRIAL_CONVERTED')),
	CONSTRAINT "ck_trial_email_pseudonym_format" CHECK ("trial"."email_pseudonym" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_trial_clock_together" CHECK (("trial"."started_at" IS NULL) = ("trial"."ends_at" IS NULL)),
	CONSTRAINT "ck_trial_clock_order" CHECK ("trial"."started_at" IS NULL OR "trial"."ends_at" >= "trial"."started_at"),
	CONSTRAINT "ck_trial_deadlines_version" CHECK ("trial"."deadlines_version" IS NULL OR "trial"."deadlines_version" >= 1),
	CONSTRAINT "ck_trial_active_complete" CHECK ("trial"."status" <> 'TRIAL_ACTIVE' OR (
                "trial"."trial_plan_id" IS NOT NULL
                AND "trial"."floor_entitlements_version_id" IS NOT NULL
                AND "trial"."floor_limits_version_id" IS NOT NULL
                AND "trial"."floor_trial_plan_version_id" IS NOT NULL
                AND "trial"."started_at" IS NOT NULL
                AND "trial"."ends_at" IS NOT NULL
                AND "trial"."deadlines_version" IS NOT NULL
            ))
);
--> statement-breakpoint
ALTER TABLE "canje_de_trial" ADD CONSTRAINT "canje_de_trial_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canje_de_trial" ADD CONSTRAINT "canje_de_trial_vertical_vertical_id_fk" FOREIGN KEY ("vertical") REFERENCES "public"."vertical"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "trial_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "trial_vertical_vertical_id_fk" FOREIGN KEY ("vertical") REFERENCES "public"."vertical"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "fk_trial_trial_plan_vertical" FOREIGN KEY ("trial_plan_id","vertical") REFERENCES "public"."plan"("id","vertical") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "fk_trial_floor_entitlements_version_vertical" FOREIGN KEY ("floor_entitlements_version_id","vertical") REFERENCES "public"."plan_version"("id","vertical") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "fk_trial_floor_limits_version_vertical" FOREIGN KEY ("floor_limits_version_id","vertical") REFERENCES "public"."plan_version"("id","vertical") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "fk_trial_floor_trial_plan_version_vertical" FOREIGN KEY ("floor_trial_plan_version_id","vertical") REFERENCES "public"."plan_version"("id","vertical") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial" ADD CONSTRAINT "fk_trial_floor_trial_plan_version_plan" FOREIGN KEY ("floor_trial_plan_version_id","trial_plan_id") REFERENCES "public"."plan_version"("id","plan_id") ON DELETE no action ON UPDATE no action;
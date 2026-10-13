CREATE TABLE "coverage_loss" (
	"user_id" uuid NOT NULL,
	"vertical" varchar(32) NOT NULL,
	"lost_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_coverage_loss" PRIMARY KEY("user_id","vertical")
);
--> statement-breakpoint
CREATE TABLE "subscription_pause" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"reason" varchar(32) NOT NULL,
	"requested_months" integer,
	"starts_at" timestamp with time zone NOT NULL,
	"expected_end_at" timestamp with time zone,
	"actual_end_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_subscription_pause_reason" CHECK ("subscription_pause"."reason" IN ('CUSTOMER_REQUEST', 'COURTESY')),
	CONSTRAINT "ck_subscription_pause_expected_end" CHECK ("subscription_pause"."expected_end_at" IS NULL OR "subscription_pause"."expected_end_at" >= "subscription_pause"."starts_at"),
	CONSTRAINT "ck_subscription_pause_actual_end" CHECK ("subscription_pause"."actual_end_at" IS NULL OR "subscription_pause"."actual_end_at" >= "subscription_pause"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "provider_link" ADD COLUMN "cancelled_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coverage_loss" ADD CONSTRAINT "coverage_loss_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_loss" ADD CONSTRAINT "coverage_loss_vertical_vertical_id_fk" FOREIGN KEY ("vertical") REFERENCES "public"."vertical"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_pause" ADD CONSTRAINT "subscription_pause_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_subscription_pause_open" ON "subscription_pause" USING btree ("subscription_id") WHERE "subscription_pause"."actual_end_at" IS NULL;
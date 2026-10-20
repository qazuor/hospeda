CREATE TABLE "subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"vertical" varchar(32),
	"plan_version_id" uuid,
	"billing_option_id" uuid,
	"payment_method" varchar(16),
	"status" varchar(32) NOT NULL,
	"class" varchar(16) NOT NULL,
	"next_charge_at" timestamp with time zone,
	"service_ends_at" timestamp with time zone,
	"first_charge_at" timestamp with time zone,
	"succeeds_id" uuid,
	"succeeded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_subscription_payment_method" CHECK ("subscription"."payment_method" IN ('CARD', 'MANUAL')),
	CONSTRAINT "ck_subscription_status" CHECK ("subscription"."status" IN ('PENDING_AUTHORIZATION', 'ABANDONED', 'ACTIVE', 'GRACE_PERIOD', 'PAUSED', 'SUSPENDED', 'CANCEL_SCHEDULED', 'CANCELLED', 'CHARGE_DECLINED')),
	CONSTRAINT "ck_subscription_class" CHECK ("subscription"."class" IN ('PRINCIPAL', 'COMPLEMENTO', 'LAPIDA')),
	CONSTRAINT "ck_subscription_succession_exclusive" CHECK (NOT ("subscription"."succeeds_id" IS NOT NULL AND "subscription"."succeeded_by_id" IS NOT NULL)),
	CONSTRAINT "ck_subscription_tombstone_cancelled" CHECK ("subscription"."class" <> 'LAPIDA' OR "subscription"."status" = 'CANCELLED'),
	CONSTRAINT "ck_subscription_identity_not_null" CHECK ("subscription"."class" = 'LAPIDA' OR ("subscription"."user_id" IS NOT NULL AND "subscription"."vertical" IS NOT NULL AND "subscription"."payment_method" IS NOT NULL)),
	CONSTRAINT "ck_subscription_principal_anchor" CHECK ("subscription"."class" <> 'PRINCIPAL' OR ("subscription"."plan_version_id" IS NOT NULL AND "subscription"."billing_option_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "subscription_scheduled_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"target_plan_version_id" uuid NOT NULL,
	"target_billing_option_id" uuid NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"plan_migration_subscription_id" uuid,
	"keep_selection" jsonb,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_subscription_scheduled_change_subscription" UNIQUE("subscription_id")
);
--> statement-breakpoint
CREATE TABLE "plan_migration_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_migration_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"application_date" timestamp with time zone NOT NULL,
	"status" varchar(16) NOT NULL,
	"out_reason" varchar(16),
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_plan_migration_subscription_pair" UNIQUE("plan_migration_id","subscription_id"),
	CONSTRAINT "ck_plan_migration_subscription_status" CHECK ("plan_migration_subscription"."status" IN ('PENDIENTE', 'APLICADA', 'FUERA', 'PARA_RESOLVER', 'CANCELADA')),
	CONSTRAINT "ck_plan_migration_subscription_out_reason_values" CHECK ("plan_migration_subscription"."out_reason" IN ('CAMBIO_DE_PLAN', 'SE_DIO_DE_BAJA', 'TERMINO')),
	CONSTRAINT "ck_plan_migration_subscription_out_reason" CHECK (("plan_migration_subscription"."status" = 'FUERA') = ("plan_migration_subscription"."out_reason" IS NOT NULL)),
	CONSTRAINT "ck_plan_migration_subscription_applied" CHECK (("plan_migration_subscription"."status" = 'APLICADA') = ("plan_migration_subscription"."applied_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "plan_migration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vertical" varchar(32) NOT NULL,
	"source_plan_version_id" uuid NOT NULL,
	"target_plan_version_id" uuid NOT NULL,
	"reason" varchar(16) NOT NULL,
	"announced_at" timestamp with time zone NOT NULL,
	"notice_days" integer NOT NULL,
	"deadline_version" integer NOT NULL,
	"signed_by" uuid NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_plan_migration_reason" CHECK ("plan_migration"."reason" IN ('RETIREMENT', 'PRICE_INCREASE')),
	CONSTRAINT "ck_plan_migration_notice_days" CHECK ("plan_migration"."notice_days" >= 60),
	CONSTRAINT "ck_plan_migration_cancel_together" CHECK (("plan_migration"."cancelled_at" IS NULL) = ("plan_migration"."cancelled_by" IS NULL)),
	CONSTRAINT "ck_plan_migration_distinct_versions" CHECK ("plan_migration"."source_plan_version_id" <> "plan_migration"."target_plan_version_id")
);
--> statement-breakpoint
CREATE TABLE "promo_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"discount_kind" varchar(16) NOT NULL,
	"value" integer NOT NULL,
	"all_verticals" boolean NOT NULL,
	"verticals" varchar(32)[],
	"total_quota" integer NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"stackable" boolean NOT NULL,
	"usable_with_another_active" boolean NOT NULL,
	"duration_kind" varchar(16) NOT NULL,
	"duration_charges" integer,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_promo_code_code" UNIQUE("code"),
	CONSTRAINT "ck_promo_code_discount_kind" CHECK ("promo_code"."discount_kind" IN ('PERCENTAGE', 'FIXED')),
	CONSTRAINT "ck_promo_code_value" CHECK ("promo_code"."value" > 0 AND ("promo_code"."discount_kind" <> 'PERCENTAGE' OR "promo_code"."value" <= 100)),
	CONSTRAINT "ck_promo_code_verticals" CHECK ("promo_code"."all_verticals" = ("promo_code"."verticals" IS NULL) AND ("promo_code"."verticals" IS NULL OR (cardinality("promo_code"."verticals") >= 1 AND "promo_code"."verticals" <@ ARRAY['accommodation', 'gastronomy', 'experience', 'tourist', 'partner']::varchar[]))),
	CONSTRAINT "ck_promo_code_total_quota" CHECK ("promo_code"."total_quota" > 0),
	CONSTRAINT "ck_promo_code_window" CHECK ("promo_code"."valid_until" > "promo_code"."valid_from"),
	CONSTRAINT "ck_promo_code_duration_kind" CHECK ("promo_code"."duration_kind" IN ('FIRST_CHARGE', 'N_CHARGES', 'FOREVER')),
	CONSTRAINT "ck_promo_code_duration_charges" CHECK (("promo_code"."duration_kind" = 'N_CHARGES') = ("promo_code"."duration_charges" IS NOT NULL) AND ("promo_code"."duration_charges" IS NULL OR "promo_code"."duration_charges" >= 1)),
	CONSTRAINT "ck_promo_code_close_together" CHECK (("promo_code"."closed_at" IS NULL) = ("promo_code"."closed_by" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "promo_redemption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promo_code_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"redeemed_at" timestamp with time zone NOT NULL,
	"subscription_id" uuid NOT NULL,
	"remaining_charges" integer,
	CONSTRAINT "uq_promo_redemption_code_user" UNIQUE("promo_code_id","user_id"),
	CONSTRAINT "ck_promo_redemption_remaining_charges" CHECK ("promo_redemption"."remaining_charges" IS NULL OR "promo_redemption"."remaining_charges" >= 0)
);
--> statement-breakpoint
CREATE TABLE "courtesy_grant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"beneficiary_user_id" uuid NOT NULL,
	"months" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"granted_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"subscription_id" uuid NOT NULL,
	"balance_months" integer,
	"balance_closed_at" timestamp with time zone,
	"close_reason" varchar(48),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_courtesy_grant_months" CHECK ("courtesy_grant"."months" > 0),
	CONSTRAINT "ck_courtesy_grant_balance_months" CHECK ("courtesy_grant"."balance_months" IS NULL OR "courtesy_grant"."balance_months" >= 0),
	CONSTRAINT "ck_courtesy_grant_close_reason" CHECK ("courtesy_grant"."close_reason" IN ('VENTANA_DE_AUTORIZACION_VENCIDA', 'GRANT_PERMANENTE_OTORGADO', 'DESTINO_DE_PLAN_NO_MENSUAL', 'CONTRACARGO_DE_LA_PREDECESORA')),
	CONSTRAINT "ck_courtesy_grant_balance_close" CHECK (("courtesy_grant"."balance_closed_at" IS NULL) = ("courtesy_grant"."close_reason" IS NULL) AND ("courtesy_grant"."balance_closed_at" IS NULL OR "courtesy_grant"."balance_months" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "addon_instance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"addon_version_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"target_id" uuid,
	"status" varchar(32) NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"complement_subscription_id" uuid,
	"order_request_id" varchar(64),
	"provider_order_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_addon_instance_complement" UNIQUE("complement_subscription_id"),
	CONSTRAINT "uq_addon_instance_order_request" UNIQUE("order_request_id"),
	CONSTRAINT "uq_addon_instance_provider_order" UNIQUE("provider_order_id"),
	CONSTRAINT "ck_addon_instance_status" CHECK ("addon_instance"."status" IN ('PENDING_AUTHORIZATION', 'ACTIVE', 'ABANDONED', 'EXPIRED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "addon_product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"price" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"charge_kind" varchar(16) NOT NULL,
	"cycle" varchar(16),
	"compatible_verticals" varchar(32)[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_addon_product_price" CHECK ("addon_product"."price" > 0),
	CONSTRAINT "ck_addon_product_currency" CHECK ("addon_product"."currency" = 'ARS'),
	CONSTRAINT "ck_addon_product_charge_kind" CHECK ("addon_product"."charge_kind" IN ('UNA_VEZ', 'PERIODICO')),
	CONSTRAINT "ck_addon_product_cycle" CHECK (("addon_product"."charge_kind" = 'PERIODICO') = ("addon_product"."cycle" IS NOT NULL) AND ("addon_product"."cycle" IS NULL OR "addon_product"."cycle" IN ('monthly', 'quarterly', 'semiannual', 'annual'))),
	CONSTRAINT "ck_addon_product_compatible_verticals" CHECK (cardinality("addon_product"."compatible_verticals") >= 1 AND "addon_product"."compatible_verticals" <@ ARRAY['accommodation', 'gastronomy', 'experience', 'tourist', 'partner']::varchar[])
);
--> statement-breakpoint
CREATE TABLE "manual_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"status" varchar(16) NOT NULL,
	"registered_by" uuid,
	"registered_at" timestamp with time zone,
	"proof_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_manual_payment_status" CHECK ("manual_payment"."status" IN ('AWAITING', 'REGISTERED', 'DECLARED_UNPAID')),
	CONSTRAINT "ck_manual_payment_registration" CHECK (("manual_payment"."status" = 'REGISTERED') = ("manual_payment"."registered_by" IS NOT NULL AND "manual_payment"."registered_at" IS NOT NULL)),
	CONSTRAINT "ck_manual_payment_proof" CHECK ("manual_payment"."proof_ref" IS NULL OR "manual_payment"."status" = 'REGISTERED')
);
--> statement-breakpoint
CREATE TABLE "idempotency_key" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"operation" varchar(32) NOT NULL,
	"subject_id" uuid NOT NULL,
	"result" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_idempotency_key_operation" CHECK ("idempotency_key"."operation" IN ('PREAPPROVAL_CREATE', 'ORDER_CREATE', 'REFUND_CREATE')),
	CONSTRAINT "ck_idempotency_key_completion" CHECK (("idempotency_key"."result" IS NULL) = ("idempotency_key"."completed_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_vertical_vertical_id_fk" FOREIGN KEY ("vertical") REFERENCES "public"."vertical"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_succeeds_id_subscription_id_fk" FOREIGN KEY ("succeeds_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_succeeded_by_id_subscription_id_fk" FOREIGN KEY ("succeeded_by_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "fk_subscription_billing_option_version" FOREIGN KEY ("billing_option_id","plan_version_id") REFERENCES "public"."billing_option"("id","plan_version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "fk_subscription_version_vertical" FOREIGN KEY ("plan_version_id","vertical") REFERENCES "public"."plan_version"("id","vertical") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_scheduled_change" ADD CONSTRAINT "subscription_scheduled_change_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_scheduled_change" ADD CONSTRAINT "subscription_scheduled_change_plan_migration_subscription_id_plan_migration_subscription_id_fk" FOREIGN KEY ("plan_migration_subscription_id") REFERENCES "public"."plan_migration_subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_scheduled_change" ADD CONSTRAINT "fk_scheduled_change_target_option" FOREIGN KEY ("target_billing_option_id","target_plan_version_id") REFERENCES "public"."billing_option"("id","plan_version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_migration_subscription" ADD CONSTRAINT "plan_migration_subscription_plan_migration_id_plan_migration_id_fk" FOREIGN KEY ("plan_migration_id") REFERENCES "public"."plan_migration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_migration_subscription" ADD CONSTRAINT "plan_migration_subscription_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_migration" ADD CONSTRAINT "plan_migration_vertical_vertical_id_fk" FOREIGN KEY ("vertical") REFERENCES "public"."vertical"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_migration" ADD CONSTRAINT "plan_migration_deadline_version_billing_deadline_version_version_fk" FOREIGN KEY ("deadline_version") REFERENCES "public"."billing_deadline_version"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_migration" ADD CONSTRAINT "plan_migration_signed_by_users_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_migration" ADD CONSTRAINT "plan_migration_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_migration" ADD CONSTRAINT "fk_plan_migration_source_vertical" FOREIGN KEY ("source_plan_version_id","vertical") REFERENCES "public"."plan_version"("id","vertical") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_migration" ADD CONSTRAINT "fk_plan_migration_target_vertical" FOREIGN KEY ("target_plan_version_id","vertical") REFERENCES "public"."plan_version"("id","vertical") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemption" ADD CONSTRAINT "promo_redemption_promo_code_id_promo_code_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_code"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemption" ADD CONSTRAINT "promo_redemption_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemption" ADD CONSTRAINT "promo_redemption_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courtesy_grant" ADD CONSTRAINT "courtesy_grant_beneficiary_user_id_users_id_fk" FOREIGN KEY ("beneficiary_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courtesy_grant" ADD CONSTRAINT "courtesy_grant_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courtesy_grant" ADD CONSTRAINT "courtesy_grant_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_instance" ADD CONSTRAINT "addon_instance_product_id_addon_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."addon_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_instance" ADD CONSTRAINT "addon_instance_addon_version_id_addon_version_id_fk" FOREIGN KEY ("addon_version_id") REFERENCES "public"."addon_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_instance" ADD CONSTRAINT "addon_instance_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_instance" ADD CONSTRAINT "addon_instance_complement_subscription_id_subscription_id_fk" FOREIGN KEY ("complement_subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_product" ADD CONSTRAINT "addon_product_version_id_addon_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."addon_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment" ADD CONSTRAINT "manual_payment_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment" ADD CONSTRAINT "manual_payment_registered_by_users_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_subscription_commitment_origin" ON "subscription" USING btree ("user_id","vertical") WHERE "subscription"."class" = 'PRINCIPAL' AND "subscription"."succeeds_id" IS NULL AND "subscription"."status" IN ('PENDING_AUTHORIZATION', 'ACTIVE', 'GRACE_PERIOD', 'PAUSED', 'SUSPENDED', 'CANCEL_SCHEDULED');--> statement-breakpoint
CREATE UNIQUE INDEX "uq_subscription_commitment_successor" ON "subscription" USING btree ("user_id","vertical") WHERE "subscription"."class" = 'PRINCIPAL' AND "subscription"."succeeds_id" IS NOT NULL AND "subscription"."status" IN ('PENDING_AUTHORIZATION', 'ACTIVE', 'GRACE_PERIOD', 'PAUSED', 'SUSPENDED', 'CANCEL_SCHEDULED');--> statement-breakpoint
CREATE INDEX "ix_subscription_scheduled_change_target_version" ON "subscription_scheduled_change" USING btree ("target_plan_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_plan_migration_subscription_one_pending" ON "plan_migration_subscription" USING btree ("subscription_id") WHERE "plan_migration_subscription"."status" = 'PENDIENTE';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_addon_instance_purchase_identity" ON "addon_instance" USING btree ("owner_id","product_id",coalesce("target_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "addon_instance"."status" = 'PENDING_AUTHORIZATION' OR ("addon_instance"."status" = 'ACTIVE' AND "addon_instance"."complement_subscription_id" IS NOT NULL);
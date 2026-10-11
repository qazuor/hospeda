CREATE TABLE "covered_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"payment_id" uuid,
	"manual_payment_id" uuid,
	"credited_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_covered_period_one_payment" CHECK (("covered_period"."payment_id" IS NOT NULL) <> ("covered_period"."manual_payment_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid,
	"addon_instance_id" uuid,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(32) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_fact_id" varchar(255) NOT NULL,
	"provider_payment_id" varchar(255),
	"fact_at" timestamp with time zone NOT NULL,
	"refunded_amount" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_payment_provider_fact" UNIQUE("provider","provider_fact_id"),
	CONSTRAINT "ck_payment_one_subject" CHECK (("payment"."subscription_id" IS NOT NULL) <> ("payment"."addon_instance_id" IS NOT NULL)),
	CONSTRAINT "ck_payment_amount_nonnegative" CHECK ("payment"."amount" >= 0),
	CONSTRAINT "ck_payment_status" CHECK ("payment"."status" IN ('PENDING', 'SUCCEEDED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK')),
	CONSTRAINT "ck_payment_refunded_amount" CHECK ("payment"."refunded_amount" >= 0 AND "payment"."refunded_amount" <= "payment"."amount"),
	CONSTRAINT "ck_payment_version" CHECK ("payment"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid,
	"manual_payment_id" uuid,
	"receipt_number" integer NOT NULL,
	"pdf_ref" text,
	"payer_name" varchar(255),
	"payer_email" varchar(255),
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_receipt_receipt_number" UNIQUE("receipt_number"),
	CONSTRAINT "ck_receipt_one_payment" CHECK (("receipt"."payment_id" IS NOT NULL) <> ("receipt"."manual_payment_id" IS NOT NULL)),
	CONSTRAINT "ck_receipt_payer_pair" CHECK (("receipt"."payer_name" IS NULL) = ("receipt"."payer_email" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "reconciliation_mark_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mark_id" uuid NOT NULL,
	"payment_id" uuid,
	"manual_payment_id" uuid,
	"hung_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"refund_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_reconciliation_mark_payment_payment" UNIQUE("mark_id","payment_id"),
	CONSTRAINT "uq_reconciliation_mark_payment_manual_payment" UNIQUE("mark_id","manual_payment_id"),
	CONSTRAINT "ck_reconciliation_mark_payment_one_payment" CHECK (("reconciliation_mark_payment"."payment_id" IS NOT NULL) <> ("reconciliation_mark_payment"."manual_payment_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "refund_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"refund_id" uuid NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"provider_refund_id" varchar(255),
	"amount" integer NOT NULL,
	"addon_instance_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_refund_call_idempotency_key" UNIQUE("idempotency_key"),
	CONSTRAINT "uq_refund_call_provider_refund_id" UNIQUE("provider_refund_id"),
	CONSTRAINT "ck_refund_call_amount_positive" CHECK ("refund_call"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid,
	"manual_payment_id" uuid,
	"amount" integer NOT NULL,
	"reason" varchar(64) NOT NULL,
	"status" varchar(16) NOT NULL,
	"confirmed_by" uuid,
	"executed_via" varchar(16),
	"settled_by" uuid,
	"external_ref" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_refund_one_payment" CHECK (("refund"."payment_id" IS NOT NULL) <> ("refund"."manual_payment_id" IS NOT NULL)),
	CONSTRAINT "ck_refund_amount_positive" CHECK ("refund"."amount" > 0),
	CONSTRAINT "ck_refund_status" CHECK ("refund"."status" IN ('REQUESTED', 'CONFIRMED', 'EXECUTED', 'FAILED')),
	CONSTRAINT "ck_refund_execution_channel" CHECK ("refund"."executed_via" IS NULL OR "refund"."executed_via" IN ('PROVIDER', 'EXTERNAL')),
	CONSTRAINT "ck_refund_execution_pair" CHECK (("refund"."status" = 'EXECUTED') = ("refund"."executed_via" IS NOT NULL)),
	CONSTRAINT "ck_refund_settled_by_execution" CHECK ("refund"."settled_by" IS NULL OR "refund"."status" = 'EXECUTED'),
	CONSTRAINT "ck_refund_version" CHECK ("refund"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "covered_period" ADD CONSTRAINT "covered_period_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "covered_period" ADD CONSTRAINT "covered_period_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "covered_period" ADD CONSTRAINT "covered_period_manual_payment_id_manual_payment_id_fk" FOREIGN KEY ("manual_payment_id") REFERENCES "public"."manual_payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_addon_instance_id_addon_instance_id_fk" FOREIGN KEY ("addon_instance_id") REFERENCES "public"."addon_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_manual_payment_id_manual_payment_id_fk" FOREIGN KEY ("manual_payment_id") REFERENCES "public"."manual_payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_mark_payment" ADD CONSTRAINT "fk_reconciliation_mark_payment_mark" FOREIGN KEY ("mark_id") REFERENCES "public"."reconciliation_mark"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_mark_payment" ADD CONSTRAINT "fk_reconciliation_mark_payment_payment" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_mark_payment" ADD CONSTRAINT "fk_reconciliation_mark_payment_manual_payment" FOREIGN KEY ("manual_payment_id") REFERENCES "public"."manual_payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_mark_payment" ADD CONSTRAINT "fk_reconciliation_mark_payment_refund" FOREIGN KEY ("refund_id") REFERENCES "public"."refund"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_call" ADD CONSTRAINT "refund_call_refund_id_refund_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refund"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_call" ADD CONSTRAINT "refund_call_idempotency_key_idempotency_key_key_fk" FOREIGN KEY ("idempotency_key") REFERENCES "public"."idempotency_key"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_call" ADD CONSTRAINT "refund_call_addon_instance_id_addon_instance_id_fk" FOREIGN KEY ("addon_instance_id") REFERENCES "public"."addon_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_manual_payment_id_manual_payment_id_fk" FOREIGN KEY ("manual_payment_id") REFERENCES "public"."manual_payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_settled_by_users_id_fk" FOREIGN KEY ("settled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_covered_period_open_subscription_period" ON "covered_period" USING btree ("subscription_id","period_start") WHERE "covered_period"."released_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refund_call_order_awaiting_id" ON "refund_call" USING btree ("addon_instance_id") WHERE "refund_call"."addon_instance_id" IS NOT NULL AND "refund_call"."provider_refund_id" IS NULL;
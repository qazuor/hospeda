CREATE TABLE "billing_orphan_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) DEFAULT 'mercadopago' NOT NULL,
	"provider_payment_id" varchar(255) NOT NULL,
	"flow" varchar(64) NOT NULL,
	"reason" varchar(64) NOT NULL,
	"subscription_id" uuid,
	"customer_id" uuid,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"livemode" boolean NOT NULL,
	"observed_status" varchar(50),
	"source" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'unresolved' NOT NULL,
	"resolution_note" text,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "orphanPayments_provider_payment_idx" ON "billing_orphan_payments" USING btree ("provider","provider_payment_id");--> statement-breakpoint
CREATE INDEX "orphanPayments_status_idx" ON "billing_orphan_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orphanPayments_subscriptionId_idx" ON "billing_orphan_payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "orphanPayments_customerId_idx" ON "billing_orphan_payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orphanPayments_detectedAt_idx" ON "billing_orphan_payments" USING btree ("detected_at");
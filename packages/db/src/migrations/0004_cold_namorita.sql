CREATE TABLE IF NOT EXISTS "billing_addon_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"subscription_id" uuid,
	"addon_slug" varchar(100) NOT NULL,
	"addon_id" uuid,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"payment_id" varchar(255),
	"limit_adjustments" jsonb DEFAULT '[]'::jsonb,
	"entitlement_adjustments" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"type" varchar(100) NOT NULL,
	"channel" varchar(50) NOT NULL,
	"recipient" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"template_id" varchar(100),
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp with time zone,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addonPurchases_customerId_idx" ON "billing_addon_purchases" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addonPurchases_addonSlug_idx" ON "billing_addon_purchases" ("addon_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addonPurchases_status_idx" ON "billing_addon_purchases" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addonPurchases_expiresAt_idx" ON "billing_addon_purchases" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addonPurchases_customer_status_idx" ON "billing_addon_purchases" ("customer_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addonPurchases_customer_addon_idx" ON "billing_addon_purchases" ("customer_id","addon_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notificationLog_customerId_idx" ON "billing_notification_log" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notificationLog_type_idx" ON "billing_notification_log" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notificationLog_status_idx" ON "billing_notification_log" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notificationLog_createdAt_idx" ON "billing_notification_log" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notificationLog_customer_type_idx" ON "billing_notification_log" ("customer_id","type");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_addon_purchases" ADD CONSTRAINT "billing_addon_purchases_customer_id_billing_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "billing_customers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

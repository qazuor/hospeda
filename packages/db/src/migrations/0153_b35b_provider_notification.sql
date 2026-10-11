CREATE TABLE "provider_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" varchar(16) NOT NULL,
	"url" text NOT NULL,
	"body" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_provider_notification_channel" CHECK ("provider_notification"."channel" IN ('IPN', 'WEBHOOKS'))
);
--> statement-breakpoint
CREATE INDEX "idx_provider_notification_received_at" ON "provider_notification" USING btree ("received_at");
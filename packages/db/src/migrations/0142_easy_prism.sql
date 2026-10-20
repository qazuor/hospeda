CREATE TABLE "provider_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"last_applied_version" varchar(255),
	"last_modified" timestamp with time zone,
	CONSTRAINT "uq_provider_link_subscription" UNIQUE("subscription_id"),
	CONSTRAINT "uq_provider_link_provider_id" UNIQUE("provider","provider_id")
);
--> statement-breakpoint
ALTER TABLE "provider_link" ADD CONSTRAINT "provider_link_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;
CREATE TABLE "provider_charge_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(255) NOT NULL,
	"charge_id" varchar(255) NOT NULL,
	"authorization_id" varchar(255),
	"provider_created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"status" varchar(32) NOT NULL,
	"purpose" varchar(64) NOT NULL,
	"reference" varchar(255),
	"decline_reason" varchar(255),
	"amount_minor" integer NOT NULL,
	"refunded_amount_minor" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) NOT NULL,
	"charged_back" boolean DEFAULT false NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_provider_charge_snapshot_provider_charge" UNIQUE("provider","charge_id")
);

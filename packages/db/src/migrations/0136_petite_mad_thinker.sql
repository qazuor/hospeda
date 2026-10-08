CREATE TABLE "billing_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"cycle" varchar(16) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_billing_option_version_cycle" UNIQUE("plan_version_id","cycle"),
	CONSTRAINT "uq_billing_option_id_version" UNIQUE("id","plan_version_id"),
	CONSTRAINT "ck_billing_option_cycle" CHECK ("billing_option"."cycle" IN ('monthly', 'quarterly', 'semiannual', 'annual')),
	CONSTRAINT "ck_billing_option_currency" CHECK ("billing_option"."currency" = 'ARS')
);
--> statement-breakpoint
ALTER TABLE "billing_option" ADD CONSTRAINT "billing_option_plan_version_id_plan_version_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_version"("id") ON DELETE no action ON UPDATE no action;
CREATE TABLE "exchange_rate_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"default_rate_type" "exchange_rate_type_enum" DEFAULT 'oficial' NOT NULL,
	"dolar_api_fetch_interval_minutes" integer DEFAULT 15 NOT NULL,
	"exchange_rate_api_fetch_interval_hours" integer DEFAULT 6 NOT NULL,
	"show_conversion_disclaimer" boolean DEFAULT true NOT NULL,
	"disclaimer_text" text,
	"enable_auto_fetch" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_currency" "price_currency_enum" NOT NULL,
	"to_currency" "price_currency_enum" NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"inverse_rate" numeric(20, 10) NOT NULL,
	"rate_type" "exchange_rate_type_enum" NOT NULL,
	"source" "exchange_rate_source_enum" NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exchange_rate_config" ADD CONSTRAINT "exchange_rate_config_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exchange_rates_currency_pair_type_idx" ON "exchange_rates" USING btree ("from_currency","to_currency","rate_type");--> statement-breakpoint
CREATE INDEX "exchange_rates_fetched_at_idx" ON "exchange_rates" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "exchange_rates_source_idx" ON "exchange_rates" USING btree ("source");
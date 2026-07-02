ALTER TABLE "billing_plans" ADD COLUMN "display_name" varchar(255) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "billing_plans" ADD COLUMN "monthly_price_ars" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "billing_plans" ADD COLUMN "annual_price_ars" integer;--> statement-breakpoint
UPDATE "billing_plans" AS p
SET
    "display_name" = COALESCE(NULLIF(p.metadata->>'displayName', ''), p.name),
    "monthly_price_ars" = COALESCE(
        (p.metadata->>'monthlyPriceArs')::integer,
        (SELECT unit_amount FROM billing_prices WHERE plan_id = p.id AND billing_interval = 'month' AND active = true LIMIT 1),
        0
    ),
    "annual_price_ars" = COALESCE(
        (p.metadata->>'annualPriceArs')::integer,
        (SELECT unit_amount FROM billing_prices WHERE plan_id = p.id AND billing_interval = 'year' AND active = true LIMIT 1)
    );

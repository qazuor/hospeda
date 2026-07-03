-- HOS-39 T-003: backfill display_name/monthly_price_ars/annual_price_ars on
-- billing_plans from their pre-existing metadata.*/billing_prices sources.
--
-- The columns themselves are added by migration 0044 (HOS-73,
-- qzpay-drizzle 1.11.0 promotion) with blank/zero placeholder defaults
-- (DEFAULT '' / DEFAULT 0) — that migration does not backfill real values.
-- This migration runs after it and fixes every existing row to the value
-- it should actually have, without touching the schema.
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

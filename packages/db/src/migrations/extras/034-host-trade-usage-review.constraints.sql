-- ============================================================================
-- 034 — HOS-376 host-trade benefit usage + review CHECK constraints
--
-- Carril 2 (extras): Drizzle cannot declare CHECK constraints, so the shape
-- invariants that are NOT expressible as a column type live here. Idempotent —
-- re-applied on every `pnpm db:apply-extras`.
--
-- Two families:
--   1. Range checks on the rating scale, including inside the JSONB breakdown.
--   2. Cross-column checks tying a terminal status to the timestamp that
--      records when it was reached. Postgres is the only place these can be
--      enforced for every writer: a service-layer guard protects the service
--      path and nothing else — not a data migration, not a psql session, not a
--      future second writer.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- host_trade_reviews — rating range
-- ---------------------------------------------------------------------------

-- The scalar rating is the required one. It starts at 1, not 0, so "did not
-- rate" and "rated the lowest" can never collapse into the same stored value.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'host_trade_reviews_overall_rating_range'
    ) THEN
        ALTER TABLE "host_trade_reviews"
            ADD CONSTRAINT "host_trade_reviews_overall_rating_range"
            CHECK ("overall_rating" BETWEEN 1 AND 5);
    END IF;
END $$;

-- The optional breakdown is JSONB, so the column type constrains nothing. Each
-- of the three dimensions, WHEN PRESENT, must sit on the same 1..5 scale as the
-- scalar — otherwise a client could store `{"punctuality": 99}` and the
-- per-dimension averages would silently drift out of range.
--
-- `rating IS NULL` passes: the breakdown is optional by design (spec §6.3), and
-- most reviews are expected to arrive without it.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'host_trade_reviews_rating_breakdown_range'
    ) THEN
        ALTER TABLE "host_trade_reviews"
            ADD CONSTRAINT "host_trade_reviews_rating_breakdown_range"
            CHECK (
                "rating" IS NULL
                OR (
                    ("rating" -> 'workQuality' IS NULL
                        OR (("rating" ->> 'workQuality')::numeric BETWEEN 1 AND 5))
                    AND ("rating" -> 'punctuality' IS NULL
                        OR (("rating" ->> 'punctuality')::numeric BETWEEN 1 AND 5))
                    AND ("rating" -> 'treatment' IS NULL
                        OR (("rating" ->> 'treatment')::numeric BETWEEN 1 AND 5))
                )
            );
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- host_trade_benefit_usages — terminal status implies its timestamp
-- ---------------------------------------------------------------------------

-- A CONFIRMED row without `confirmed_at` is a usage that counts toward a
-- provider's public numbers with no record of when it started counting —
-- unauditable, and impossible to reconstruct after the fact.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'host_trade_benefit_usages_confirmed_at_present'
    ) THEN
        ALTER TABLE "host_trade_benefit_usages"
            ADD CONSTRAINT "host_trade_benefit_usages_confirmed_at_present"
            CHECK ("status" <> 'CONFIRMED' OR "confirmed_at" IS NOT NULL);
    END IF;
END $$;

-- A REJECTED row without `rejected_at` is worse: rejections feed the rolling
-- suspension window (spec §6.5), and a rejection with no timestamp can never
-- age out of that window — it would count against the provider forever.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'host_trade_benefit_usages_rejected_at_present'
    ) THEN
        ALTER TABLE "host_trade_benefit_usages"
            ADD CONSTRAINT "host_trade_benefit_usages_rejected_at_present"
            CHECK ("status" <> 'REJECTED' OR "rejected_at" IS NOT NULL);
    END IF;
END $$;

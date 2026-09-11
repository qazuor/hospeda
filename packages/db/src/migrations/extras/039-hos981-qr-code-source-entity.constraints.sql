-- ============================================================================
-- 039 — HOS-981 qr_codes source/entity correlation CHECK constraints
--
-- Carril 2 (extras): Drizzle cannot declare CHECK constraints, and this one is
-- cross-column logic between `source`, `entity_type` and `entity_id`, so it
-- cannot be a column type either. Idempotent — re-applied on every
-- `pnpm db:apply-extras`.
--
-- What it enforces:
--   A GENERATED code is owned by the entity it was derived from, so it MUST
--   name that entity. A MANUAL code was typed into the admin panel by an
--   operator and belongs to nobody, so it must NOT name one.
--
-- Why it is not left to the JSDoc that asserted it:
--   Nothing enforced this before, so `{source: MANUAL, entityId: <uuid>}`
--   parsed, saved, and produced a row that reads as owned by an entity that
--   never generated it — while `{source: GENERATED}` with both columns null
--   produced a code no lookup by entity can ever find again. Postgres is the
--   only place this holds for every writer: the Zod refine on the create input
--   protects the service path and nothing else — not a data migration, not a
--   psql session, not the PR-4 generator.
--
-- Both columns move together on purpose. A GENERATED code carrying only
-- `entity_type` is not half-identified, it is unidentified: the composite index
-- on (entity_type, entity_id) is what answers "does this provider already have
-- a QR?", and a null id makes that question unanswerable while looking answered.
--
-- Existing rows: the table ships in this same release and holds none, so the
-- plain ADD CONSTRAINT form is safe (no NOT VALID + VALIDATE dance needed).
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'qr_codes_source_entity_correlation'
    ) THEN
        ALTER TABLE "qr_codes"
            ADD CONSTRAINT "qr_codes_source_entity_correlation"
            CHECK (
                ("source" = 'GENERATED'
                    AND "entity_type" IS NOT NULL
                    AND "entity_id" IS NOT NULL)
                OR
                ("source" = 'MANUAL'
                    AND "entity_type" IS NULL
                    AND "entity_id" IS NULL)
            );
    END IF;
END $$;

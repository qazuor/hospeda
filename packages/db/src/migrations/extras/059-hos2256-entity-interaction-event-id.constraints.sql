-- ============================================================================
-- 059 — HOS-2256 entity_interactions: event_id coherence CHECK
--
-- Carril 2 (extras): Drizzle cannot declare CHECK constraints. Idempotent —
-- re-applied on every `pnpm db:apply-extras`.
--
-- `event_id` only makes sense for the two event kinds. Postgres is the only
-- place this holds for every writer (a service guard protects the service path
-- and nothing else).
--
-- NOT VALID is not used: the table is created empty by the same release, so
-- there is nothing to validate and the constraint is checked for every row.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'entity_interactions_event_id_kind_check'
    ) THEN
        ALTER TABLE "entity_interactions"
            ADD CONSTRAINT "entity_interactions_event_id_kind_check"
            CHECK ("event_id" IS NULL OR "kind" IN ('TICKET_CLICK', 'EVENT_IMPRESSION'));
    END IF;
END $$;

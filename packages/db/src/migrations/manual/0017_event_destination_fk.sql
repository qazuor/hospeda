-- =============================================================================
-- Migration: 0017_event_destination_fk.sql
--
-- Adds destinationId FK column to the events table so events can be
-- associated with a geographic destination (REQ-096-02 / SPEC-096).
--
-- Design decisions:
--   - Column is nullable (UUID NULL) because existing events have no
--     destination assigned and backfill is handled separately.
--   - ON DELETE SET NULL: when a destination is (soft-)deleted or eventually
--     hard-deleted, events are NOT deleted — they just lose the association.
--   - Index on destination_id is needed because the primary query pattern is
--     GET /events?destinationId={uuid}, which filters by this column.
--
-- This script is IDEMPOTENT — safe to run multiple times.
-- =============================================================================

-- 1. Add the column (idempotent via IF NOT EXISTS)
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS destination_id UUID NULL;

-- 2. Add the FK constraint (idempotent: skip if it already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'events_destination_id_fkey'
          AND table_name = 'events'
    ) THEN
        ALTER TABLE events
            ADD CONSTRAINT events_destination_id_fkey
            FOREIGN KEY (destination_id)
            REFERENCES destinations(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

-- 3. Create index (idempotent via IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS events_destination_id_idx
    ON events (destination_id);

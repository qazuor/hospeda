-- =============================================================================
-- 0014_extend_delete_entity_bookmarks_trigger.sql
-- Purpose: Extend delete_entity_bookmarks() to ALSO fire on soft-delete events.
--          A soft-delete occurs when deleted_at transitions from NULL to a
--          non-NULL timestamp (AFTER UPDATE WHERE OLD.deleted_at IS NULL AND
--          NEW.deleted_at IS NOT NULL).
--
--          The hard-delete (AFTER DELETE) behavior from migration 0006 is
--          preserved exactly.
--
-- Covered tables: accommodations, destinations, events, users, posts
-- Entity type enum literals (uppercase): ACCOMMODATION, DESTINATION, EVENT,
--          USER, POST
--
-- Depends on: 0006_delete_entity_bookmarks_trigger.sql must already exist
--             (defines the function and AFTER DELETE triggers)
-- Date: 2026-04-18
-- GAP: GAP-078-192
-- =============================================================================

-- Replace the trigger function so it handles both DELETE and UPDATE events.
-- TG_OP distinguishes which path to take.
-- On AFTER DELETE  -> OLD.id is used (same as before).
-- On AFTER UPDATE  -> guard ensures we only act when deleted_at goes NULL→value.
CREATE OR REPLACE FUNCTION delete_entity_bookmarks()
  RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_id   TEXT;
BEGIN
  -- Resolve entity_type from the table that fired the trigger.
  IF TG_TABLE_NAME = 'accommodations' THEN
    v_entity_type := 'ACCOMMODATION';
  ELSIF TG_TABLE_NAME = 'destinations' THEN
    v_entity_type := 'DESTINATION';
  ELSIF TG_TABLE_NAME = 'events' THEN
    v_entity_type := 'EVENT';
  ELSIF TG_TABLE_NAME = 'users' THEN
    v_entity_type := 'USER';
  ELSIF TG_TABLE_NAME = 'posts' THEN
    v_entity_type := 'POST';
  ELSE
    -- Unrecognised table — no-op, return appropriate pseudo-row.
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Hard delete: remove bookmarks for the deleted row.
    v_entity_id := OLD.id;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Soft delete: only act when deleted_at transitions NULL → non-NULL.
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_entity_id := OLD.id;
    ELSE
      -- Not a soft-delete transition — nothing to do.
      RETURN NEW;
    END IF;

  ELSE
    -- INSERT or other ops — should not reach here given trigger definitions.
    RETURN NEW;
  END IF;

  DELETE FROM user_bookmarks
    WHERE entity_type = v_entity_type
      AND entity_id   = v_entity_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- -----------------------------------------------------------------------
-- Soft-delete (AFTER UPDATE) triggers — one per bookmarkable entity table.
-- The pre-existing AFTER DELETE triggers from 0006 remain untouched.
-- -----------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_softdelete_bookmarks_on_accommodations ON accommodations;
CREATE TRIGGER trg_softdelete_bookmarks_on_accommodations
  AFTER UPDATE ON accommodations
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

DROP TRIGGER IF EXISTS trg_softdelete_bookmarks_on_destinations ON destinations;
CREATE TRIGGER trg_softdelete_bookmarks_on_destinations
  AFTER UPDATE ON destinations
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

DROP TRIGGER IF EXISTS trg_softdelete_bookmarks_on_events ON events;
CREATE TRIGGER trg_softdelete_bookmarks_on_events
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

DROP TRIGGER IF EXISTS trg_softdelete_bookmarks_on_users ON users;
CREATE TRIGGER trg_softdelete_bookmarks_on_users
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

DROP TRIGGER IF EXISTS trg_softdelete_bookmarks_on_posts ON posts;
CREATE TRIGGER trg_softdelete_bookmarks_on_posts
  AFTER UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

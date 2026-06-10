-- =============================================================================
-- 003-delete-entity-bookmarks.trigger.sql
-- Consolidates:
--   0006_delete_entity_bookmarks_trigger.sql          (original function + AFTER DELETE triggers)
--   0014_extend_delete_entity_bookmarks_trigger.sql   (extended to handle soft-deletes)
--   0018_fix_delete_entity_bookmarks_enum_cast.sql    (FINAL: explicit entity_type_enum cast)
--
-- The function body from 0018 is used as the canonical final version.
-- Key changes across the evolution:
--   0006: Original AFTER DELETE only, TEXT comparison (no explicit cast).
--   0014: Added AFTER UPDATE soft-delete handling (deleted_at NULL → non-NULL).
--   0018: Fixed v_entity_type::entity_type_enum cast to prevent
--         "operator does not exist: entity_type_enum = text" error on hard DELETE.
--         Also changed v_entity_id type from TEXT (0014) to UUID (correct column type).
--
-- Idempotency:
--   CREATE OR REPLACE FUNCTION is always safe.
--   DROP TRIGGER IF EXISTS before each CREATE TRIGGER ensures correct function
--   version is attached even when re-running after a function update.
-- =============================================================================

-- Trigger function: final version from 0018.
-- Handles both AFTER DELETE (hard-delete) and AFTER UPDATE (soft-delete).
-- Explicit casts to entity_type_enum and UUID match the user_bookmarks column types.
CREATE OR REPLACE FUNCTION delete_entity_bookmarks()
  RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_id   UUID;
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

  -- Explicit cast: user_bookmarks.entity_type is entity_type_enum and
  -- user_bookmarks.entity_id is uuid. Without explicit casts, PostgreSQL raises:
  --   ERROR: operator does not exist: entity_type_enum = text
  --   ERROR: operator does not exist: uuid = text
  DELETE FROM user_bookmarks
    WHERE entity_type = v_entity_type::entity_type_enum
      AND entity_id   = v_entity_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- -----------------------------------------------------------------------
-- AFTER DELETE triggers — fire on hard-delete (from 0006).
-- -----------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_accommodations ON accommodations;
CREATE TRIGGER trg_delete_bookmarks_on_accommodations
  AFTER DELETE ON accommodations
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_destinations ON destinations;
CREATE TRIGGER trg_delete_bookmarks_on_destinations
  AFTER DELETE ON destinations
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_events ON events;
CREATE TRIGGER trg_delete_bookmarks_on_events
  AFTER DELETE ON events
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

-- The users table is named "users" (plural) in this schema.
DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_users ON users;
CREATE TRIGGER trg_delete_bookmarks_on_users
  AFTER DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_posts ON posts;
CREATE TRIGGER trg_delete_bookmarks_on_posts
  AFTER DELETE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();


-- -----------------------------------------------------------------------
-- AFTER UPDATE (soft-delete) triggers — fire when deleted_at goes NULL→value
-- (from 0014).
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

-- =============================================================================
-- 0018_fix_delete_entity_bookmarks_enum_cast.sql
-- Purpose: Fix the delete_entity_bookmarks() trigger function to explicitly
--          cast its TEXT-typed v_entity_type local to entity_type_enum when
--          comparing against the user_bookmarks.entity_type column.
--
-- Root cause: PostgreSQL refuses to compare entity_type_enum with TEXT
--             without an explicit cast (`operator does not exist:
--             entity_type_enum = text`). This made any hard DELETE on
--             accommodations / destinations / events / users / posts crash
--             when the trigger fired.
--
-- Discovered: SPEC-086 T-045 cascade regression tests (2026-04-30).
--
-- This is the SAME function created by 0014. Re-creating it via OR REPLACE
-- preserves the pre-existing AFTER DELETE and AFTER UPDATE trigger
-- attachments — only the function body changes.
-- =============================================================================

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
  -- user_bookmarks.entity_id is uuid. Without explicit casts, PostgreSQL
  -- raises:
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

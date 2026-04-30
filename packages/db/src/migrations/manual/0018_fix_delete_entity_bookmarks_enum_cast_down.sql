-- =============================================================================
-- 0018_fix_delete_entity_bookmarks_enum_cast_down.sql
-- Purpose: Revert 0018 by restoring the 0014 function body without the
--          explicit ::entity_type_enum cast. Triggers stay attached.
-- WARNING: After running this, hard DELETE on the bookmarkable tables will
--          fail again with `operator does not exist: entity_type_enum = text`.
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_entity_bookmarks()
  RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_id   UUID;
BEGIN
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
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_entity_id := OLD.id;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
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

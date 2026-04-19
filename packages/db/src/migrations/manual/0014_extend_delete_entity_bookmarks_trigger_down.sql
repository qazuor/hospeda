-- =============================================================================
-- 0014_extend_delete_entity_bookmarks_trigger_down.sql
-- Purpose: Rollback for 0014_extend_delete_entity_bookmarks_trigger.sql.
--
--          Restores the trigger function to the original AFTER DELETE-only
--          version defined in 0006_delete_entity_bookmarks_trigger.sql and
--          drops the soft-delete (AFTER UPDATE) triggers added by 0014.
--
--          The AFTER DELETE triggers (trg_delete_bookmarks_on_*) are NOT
--          touched — they remain exactly as created by migration 0006.
--
-- Date: 2026-04-18
-- GAP: GAP-078-192
-- =============================================================================

-- Drop the soft-delete (AFTER UPDATE) triggers introduced by migration 0014.
DROP TRIGGER IF EXISTS trg_softdelete_bookmarks_on_accommodations ON accommodations;
DROP TRIGGER IF EXISTS trg_softdelete_bookmarks_on_destinations   ON destinations;
DROP TRIGGER IF EXISTS trg_softdelete_bookmarks_on_events         ON events;
DROP TRIGGER IF EXISTS trg_softdelete_bookmarks_on_users          ON users;
DROP TRIGGER IF EXISTS trg_softdelete_bookmarks_on_posts          ON posts;


-- Restore the trigger function to the original AFTER DELETE-only version
-- (verbatim body from 0006_delete_entity_bookmarks_trigger.sql).
CREATE OR REPLACE FUNCTION delete_entity_bookmarks()
  RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'accommodations' THEN
    DELETE FROM user_bookmarks
      WHERE entity_type = 'ACCOMMODATION'
        AND entity_id = OLD.id;

  ELSIF TG_TABLE_NAME = 'destinations' THEN
    DELETE FROM user_bookmarks
      WHERE entity_type = 'DESTINATION'
        AND entity_id = OLD.id;

  ELSIF TG_TABLE_NAME = 'events' THEN
    DELETE FROM user_bookmarks
      WHERE entity_type = 'EVENT'
        AND entity_id = OLD.id;

  ELSIF TG_TABLE_NAME = 'users' THEN
    DELETE FROM user_bookmarks
      WHERE entity_type = 'USER'
        AND entity_id = OLD.id;

  ELSIF TG_TABLE_NAME = 'posts' THEN
    DELETE FROM user_bookmarks
      WHERE entity_type = 'POST'
        AND entity_id = OLD.id;

  ELSE
    RETURN OLD;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

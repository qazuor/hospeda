-- ================================================================
-- Migration: 20250513_update_delete_entity_bookmarks_trigger.sql
-- Purpose: Update delete_entity_bookmarks() to match uppercase
--          EntityTypeEnum values and reattach triggers.
-- ================================================================

-- 1) Replace the trigger function with uppercase enum literals
CREATE OR REPLACE FUNCTION delete_entity_bookmarks()
  RETURNS TRIGGER AS $$
BEGIN
  -- Determine which entity type fired this trigger based on table name
  IF TG_TABLE_NAME = 'accommodations' THEN
    -- Accommodation was deleted
    DELETE FROM user_bookmarks
      WHERE entity_type = 'ACCOMMODATION'
        AND entity_id = OLD.id;

  ELSIF TG_TABLE_NAME = 'destinations' THEN
    -- Destination was deleted
    DELETE FROM user_bookmarks
      WHERE entity_type = 'DESTINATION'
        AND entity_id = OLD.id;

  ELSIF TG_TABLE_NAME = 'events' THEN
    -- Event was deleted
    DELETE FROM user_bookmarks
      WHERE entity_type = 'EVENT'
        AND entity_id = OLD.id;

  ELSIF TG_TABLE_NAME = 'user' THEN
    -- User was deleted
    DELETE FROM user_bookmarks
      WHERE entity_type = 'USER'
        AND entity_id = OLD.id;

  ELSIF TG_TABLE_NAME = 'posts' THEN
    -- Post was deleted
    DELETE FROM user_bookmarks
      WHERE entity_type = 'POST'
        AND entity_id = OLD.id;

  ELSE
    -- Other tables: do nothing
    RETURN OLD;
  END IF;

  -- Return OLD to allow the deletion to proceed
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;


-- 2) Drop existing triggers (if they exist) and reattach them

-- For accommodations
DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_accommodations ON accommodations;
CREATE TRIGGER trg_delete_bookmarks_on_accommodations
  AFTER DELETE ON accommodations
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

-- For destinations
DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_destinations ON destinations;
CREATE TRIGGER trg_delete_bookmarks_on_destinations
  AFTER DELETE ON destinations
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

-- For events
DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_events ON events;
CREATE TRIGGER trg_delete_bookmarks_on_events
  AFTER DELETE ON events
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

-- For users
DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_user ON "user";
CREATE TRIGGER trg_delete_bookmarks_on_user
  AFTER DELETE ON "user"
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

-- For posts
DROP TRIGGER IF EXISTS trg_delete_bookmarks_on_posts ON posts;
CREATE TRIGGER trg_delete_bookmarks_on_posts
  AFTER DELETE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION delete_entity_bookmarks();

-- =============================================================================
-- 0006_delete_entity_bookmarks_trigger.sql
-- Purpose: Create the delete_entity_bookmarks() AFTER DELETE trigger function
--          and attach it to all entity tables that can be bookmarked.
--          When an entity row is hard-deleted, its corresponding rows in
--          user_bookmarks are automatically removed.
-- Depends on: user_bookmarks, accommodations, destinations, events, "user",
--             posts tables must exist.
-- Related commit: f9e0d338 (deleted), recovered from f9e0d338~1
-- Date: 2026-04-18
-- =============================================================================

-- Trigger function: dispatches on TG_TABLE_NAME to delete matching bookmarks.
-- Uses uppercase EntityTypeEnum literals (ACCOMMODATION, DESTINATION, EVENT,
-- USER, POST) matching the application-level enum values.
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


-- Attach triggers: DROP IF EXISTS + CREATE ensures the correct function
-- version is attached even when re-running after a function update.

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

-- =============================================================================
-- 010-entity-views.indexes.sql
-- Mirrors the indexes declared on the entityViews Drizzle model
-- (packages/db/src/schemas/entity-view/entity_view.dbschema.ts, SPEC-159).
--
-- Why this file exists:
--   Drizzle-kit generates these as standard BTREE indexes in migration
--   0003_naive_nicolaos.sql. This extras file provides defensive enforcement
--   for environments provisioned before that migration was applied, and
--   ensures they are present after any db:push / schema reset cycle
--   (which bypasses the versioned migration history).
--
-- Idempotency:
--   Both indexes use CREATE INDEX IF NOT EXISTS directly — no DO blocks needed
--   because neither index is partial or conditional.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- idx_entity_views_entity_time
-- Compound index on entity_views(entity_type, entity_id, viewed_at).
--
-- Primary access pattern: "how many views did entity X receive between
-- times A and B?" and "all views for entity X ordered by time". Also
-- supports TTL purge cron queries scoped to a specific entity.
-- SPEC-159 §5.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_entity_views_entity_time
    ON entity_views (entity_type, entity_id, viewed_at);

-- ---------------------------------------------------------------------------
-- idx_entity_views_time
-- Single-column index on entity_views(viewed_at).
--
-- Supports global time-range scans used by the TTL purge cron:
--   DELETE FROM entity_views WHERE viewed_at < NOW() - INTERVAL '95 days'
-- SPEC-159 §5.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_entity_views_time
    ON entity_views (viewed_at);

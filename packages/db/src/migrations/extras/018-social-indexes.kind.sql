-- =============================================================================
-- 018-social-indexes.kind.sql
-- SPEC-254: Social Media Publish — Phase 1 Data Model
--
-- Performance indexes for the social publishing tables introduced in migration
-- 0022_cuddly_natasha_romanoff.sql. These indexes are Drizzle-invisible (they
-- are either partial indexes or operational concerns outside the schema DSL)
-- and therefore live in the extras carril.
--
-- Indexes:
--   1. idx_social_posts_status
--      Fast lookups by post workflow status (NEEDS_REVIEW, APPROVED, etc.)
--   2. idx_social_posts_next_run_at (PARTIAL — next_run_at IS NOT NULL)
--      Scheduler query: find posts due to run. Excludes one-shot posts with
--      no recurrence so the index stays small.
--   3. idx_social_post_targets_status
--      Fast lookups by target publish status.
--   4. idx_social_audit_log_entity
--      Composite on (entity_type, entity_id) for per-entity audit history queries.
--   5. idx_social_publish_logs_post
--      Composite on (social_post_id, created_at DESC) for chronological log
--      retrieval per post.
--
-- Idempotency:
--   All statements use CREATE INDEX IF NOT EXISTS. Safe to re-run any number
--   of times (pnpm db:apply-extras is idempotent by design).
--
-- Column names verified against CREATE TABLE blocks in
-- 0022_cuddly_natasha_romanoff.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. social_posts — filter by workflow status
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_social_posts_status
  ON public.social_posts (status);

-- ---------------------------------------------------------------------------
-- 2. social_posts — scheduler: posts with a pending next_run_at (PARTIAL)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_social_posts_next_run_at
  ON public.social_posts (next_run_at)
  WHERE next_run_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. social_post_targets — filter by publish status per target
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_social_post_targets_status
  ON public.social_post_targets (status);

-- ---------------------------------------------------------------------------
-- 4. social_audit_log — per-entity audit history lookup
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_social_audit_log_entity
  ON public.social_audit_log (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- 5. social_publish_logs — chronological log retrieval per post
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_social_publish_logs_post
  ON public.social_publish_logs (social_post_id, created_at DESC);

-- 012-content-moderation-thresholds.check.sql (carril 2, idempotent)
-- Cross-column CHECK constraint for content_moderation_thresholds (SPEC-195).
-- Drizzle cannot emit cross-column checks; this lives in extras/ and is
-- re-applied by `pnpm db:apply-extras` after every `pnpm db:migrate`.

ALTER TABLE content_moderation_thresholds
    DROP CONSTRAINT IF EXISTS ck_content_moderation_thresholds_pending_lt_reject;
ALTER TABLE content_moderation_thresholds
    ADD CONSTRAINT ck_content_moderation_thresholds_pending_lt_reject
    CHECK (pending < reject);

-- Down migration for 0005_awesome_wild_child.sql (SPEC-063 T-029 DestinationReview lifecycleState).
-- Rolls back the additive column + index introduced for lifecycle state standardization.
-- Safe to run only when no service/query depends on `destination_reviews.lifecycle_state`
-- (re-apply service-core SPEC-063 revert first). Runs as two statements, index before column
-- for symmetry with the up migration even though DROP COLUMN cascades the index automatically.

DROP INDEX IF EXISTS "destinationReviews_lifecycleState_idx";--> statement-breakpoint
ALTER TABLE "destination_reviews" DROP COLUMN IF EXISTS "lifecycle_state";

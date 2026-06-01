-- SPEC-177 (Phase 2 of SPEC-158): backfill display_order for existing FAQ rows.
--
-- The `display_order` column is added to destination_faqs / accommodation_faqs via the
-- Drizzle schema (drizzle-kit push), nullable. This manual migration assigns a stable
-- initial order to any pre-existing rows, per parent, ordered by created_at ascending
-- (0-based). It is applied by packages/db/scripts/apply-postgres-extras.mjs after push.
--
-- Idempotent: only rows where display_order IS NULL are touched, so re-running on a
-- fresh-dev DB (where new FAQs already get max+1 from the service) is a no-op.

UPDATE destination_faqs df
SET display_order = sub.rn
FROM (
    SELECT id,
           (ROW_NUMBER() OVER (PARTITION BY destination_id ORDER BY created_at ASC) - 1)::integer AS rn
    FROM destination_faqs
    WHERE display_order IS NULL
) sub
WHERE df.id = sub.id;

UPDATE accommodation_faqs af
SET display_order = sub.rn
FROM (
    SELECT id,
           (ROW_NUMBER() OVER (PARTITION BY accommodation_id ORDER BY created_at ASC) - 1)::integer AS rn
    FROM accommodation_faqs
    WHERE display_order IS NULL
) sub
WHERE af.id = sub.id;

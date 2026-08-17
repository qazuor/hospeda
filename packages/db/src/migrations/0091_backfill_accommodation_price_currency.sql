-- Custom SQL migration file, put your code below! --

-- =============================================================================
-- H-167 — backfill `accommodations.price.currency` for rows that have a price
-- but no currency.
--
-- Why this migration exists:
--   The write path (`AccommodationUpdateHttpSchema` / `AccommodationCreateDraftHttpSchema`
--   converters in packages/schemas/src/entities/accommodation/accommodation.http.schema.ts)
--   used to allow a PATCH/create-draft carrying `basePrice` with no `currency`
--   to shallow-merge a bare `{"price": N}` onto the stored JSONB `price` column,
--   with no `currency` sibling. Verified against prod: 2 of 5 priced
--   accommodations have `{"price": 45000}` with no `currency` key, alongside
--   rows that correctly carry `{"price": 80000, "currency": "ARS"}`. The admin
--   list rendered these two shapes visibly differently (H-167,
--   apps/admin/src/components/table/cells/PriceCell.tsx).
--
--   That write-path gap is now closed (H-167 fix: the converters inject
--   `currency: 'ARS'` whenever `basePrice` is being set and no currency was
--   supplied). This migration is the one-shot backfill for the rows that were
--   already written under the old, buggy behaviour.
--
-- Why ARS:
--   ARS is the accommodation domain's documented storage currency
--   (`packages/db/src/models/accommodation/accommodation.model.ts`: "stores the
--   nightly base price under `price.price` in ARS") and the same fallback the
--   public render already assumes (`apps/web/src/components/accommodation/PricingSidebar.astro`'s
--   `price?.currency ?? 'ARS'`).
--
-- Carril:
--   1 — versioned, hand-written data conversion, journal-tracked, generated as
--   a `drizzle-kit generate --custom` skeleton (no schema/column change — `price`
--   is an existing JSONB column, this only touches its stored VALUES). Per
--   `packages/db/CLAUDE.md` "Golden Rule": a data conversion (row UPDATE) lands
--   in `src/migrations/`, not `src/migrations/extras/` (extras is DML-free by
--   convention — see docs/guides/migrations.md — and is reserved for
--   Drizzle-invisible schema objects: triggers, matviews, CHECK constraints,
--   special indexes). Mirrors the precedent set by
--   0008_strip_accommodation_description_markdown.sql, the prior hand-written,
--   schema-less data migration in this same carril.
--
-- Idempotency:
--   The WHERE clause only matches rows where `price` IS NOT NULL and the
--   `currency` key is absent. Once a row is backfilled it carries a `currency`
--   key and no longer matches on a re-run, so running this migration twice is
--   a no-op the second time — no `IF NOT EXISTS` trickery needed for a plain
--   UPDATE.
--
-- Scope:
--   `deleted_at IS NULL` — soft-deleted rows are excluded; a deleted
--   accommodation's stored price shape is not this migration's concern, and
--   scanning past the soft-delete filter would misreport who is actually
--   affected (see project CLAUDE.md "Common Gotchas" on `deleted_at`
--   filtering).
-- =============================================================================

-- Shape guard:
--   `price` is `jsonb(...).$type<Record<string, unknown>>()` — a TypeScript
--   annotation, not a database constraint. `accommodation.access.schema.ts`
--   says as much: "nothing but Zod has ever gated what landed there". If any
--   row holds a scalar or an array instead of an object, `||` raises
--   "cannot concatenate a non-object" and takes the whole migration — and the
--   deploy — down with it. `jsonb_typeof` keeps a single malformed row from
--   blocking the backfill for every well-formed one.
UPDATE "accommodations"
SET "price" = "price" || jsonb_build_object('currency', 'ARS')
WHERE "deleted_at" IS NULL
  AND "price" IS NOT NULL
  AND jsonb_typeof("price") = 'object'
  AND NOT ("price" ? 'currency');
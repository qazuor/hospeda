---
spec-id: SPEC-204
title: Accommodation gallery migration to relational table
type: refactor
complexity: high
status: in-progress
created: 2026-06-06T00:00:00Z
formalized: 2026-06-22T00:00:00Z
depends_on: [SPEC-167]
relates_to: [SPEC-186]
priority: low
base: staging
worktree: spec-204-accommodation-gallery-relational-migration
---

# SPEC-204: Accommodation gallery migration to relational table

> **Formalized 2026-06-22 (owner-confirmed).** This spec was a 2KB scope-sketch spun off from the
> SPEC-167 realign (decision D-2). Before atomization the owner locked the architecture: the storage
> model (direct table-per-entity vs polymorphic vs junction), the table shape, the state model, the
> migration strategy, and the API contract. Those decisions are §3–§7 below.

## 1. Problem

Accommodation photos live embedded in the `accommodations.media` JSONB column (`featuredImage` +
`gallery[]`, plus SPEC-167's `archivedGallery[]` for downgrade-restricted photos). JSONB cannot model:

- **Per-photo state** as data (visible / archived / pending-moderation) — every state mechanism
  (SPEC-167's `archivedGallery`) is a JSONB-shape workaround (move items between arrays).
- **Ordering as data** — gallery order is array position, not a queryable/updatable column.
- **Referential integrity** — a photo has no identity beyond its URL; nothing guarantees consistency.
- **Efficient counting** — `enforcePhotoLimit` (`MAX_PHOTOS_PER_ACCOMMODATION`) re-parses the JSONB blob
  on every check instead of counting rows.

The fix is to move the gallery to a relational table with real referential integrity — which is the
explicit goal that drives the storage-model decision in §2.

## 2. Storage model decision (D6 — the core architecture choice)

Three models were evaluated. The deciding fact: **a gallery photo belongs to exactly ONE accommodation
(1:N), never shared across entities.** No many-to-many relationship exists in this domain.

| Model | Integrity | Read performance | Verdict |
|-------|-----------|------------------|---------|
| **A. Polymorphic** `entity_media(entity_type, entity_id, …)` | Weak — `entity_id` cannot FK 6 tables; needs app/trigger validation. **Defeats the spec's goal of gaining referential integrity.** | Medium — one large mixed table, composite index, filter by type | ❌ rejected |
| **B. Media + junction** `media(id, …)` + `r_accommodation_media(accommodation_id, media_id, …)` | Strong (2 FKs) but a junction models M:N; using it for a 1:N relation creates orphan-lifecycle complexity and an ambiguous home for `sort_order`/`is_featured`. | **Worst** — double JOIN to read a gallery; two growing tables | ❌ rejected (over-normalization, no integrity gain over C) |
| **C. Direct table-per-entity** `accommodation_media(id, accommodation_id FK, …)` | **Strongest** — real FK + `ON DELETE CASCADE` | **Best** — single JOIN, small focused table, index on `accommodation_id` | ✅ **chosen** |

**Decision: Model C — `accommodation_media`, a direct per-entity table with a real FK.** It wins on BOTH
robustness and performance; it is not a tradeoff. Convention precedent: `accommodation_faq` is
table-per-entity. The pattern is reusable (§8) so future per-entity migrations are copy-instantiate,
not redesign.

## 3. Data model — `accommodation_media` (D1, D3)

**D1 Scope:** the table holds `gallery` + `archivedGallery` + `featuredImage`. **Videos STAY in the
`media` JSONB** — they have no per-item state and no ordering need (YAGNI).

Columns (each row mirrors `ImageSchema` from `packages/schemas/src/common/media.schema.ts` EXACTLY — the
Explore audit confirmed inline JSONB shapes elsewhere drop `publicId`/`attribution`; this migration must
NOT lose that data):

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | per-photo identity — kills URL-as-identity fragility (D3) |
| `accommodation_id` | `uuid` NOT NULL | FK → `accommodations(id)` `ON DELETE CASCADE` |
| `url` | `text` NOT NULL | from `ImageSchema` |
| `caption` | `text` nullable | from `ImageSchema` |
| `description` | `text` nullable | from `ImageSchema` |
| `alt` | `text` nullable | from `ImageSchema` |
| `public_id` | `text` nullable | from `ImageSchema` — MUST be preserved |
| `attribution` | `text`/jsonb nullable | from `ImageSchema` — MUST be preserved (match source shape) |
| `moderation_state` | enum | per-image `ModerationStatusPgEnum` (already exists; not accommodation-specific) |
| `state` | enum `'visible' \| 'archived'` | D2 — replaces the `gallery` vs `archivedGallery` array split |
| `is_featured` | `boolean` NOT NULL default false | D2 — replaces `featuredImage` |
| `sort_order` | `int` NOT NULL | gallery order as data (D3) |
| `archived_at` | `timestamp` nullable | exact FIFO for SPEC-167 restore (D3) |
| `created_at` / `updated_at` / `deleted_at` | timestamps | `BaseModel` convention (soft-delete) |

## 4. State & invariants (D2)

State is modeled as `state` enum + `is_featured` boolean (NOT a 3-way kind enum), enforced at the DB
level via the **extras carril** (Drizzle-invisible objects):

- **Partial unique index:** `UNIQUE(accommodation_id) WHERE is_featured = true` — at most one featured
  photo per accommodation.
- **CHECK constraint:** `NOT (is_featured AND state = 'archived')` — a featured photo cannot be archived.
- Pending-moderation is already covered by the per-image `moderation_state` column (no new mechanism).

## 5. Migration strategy (D4 — dual-write, 3-phase transition window)

No big-bang. Reads stay on JSONB until the table is proven, then flip.

- **P1 — Create + backfill + write-both.** Create the table (structural carril: `db:generate` +
  `db:migrate`); add the partial unique index + CHECK (extras carril, idempotent). Backfill from JSONB:
  `featuredImage` → row `is_featured=true`; `gallery[]` → rows `state='visible'`, `sort_order=index`;
  `archivedGallery[]` → rows `state='archived'` with `archived_at`. Writes go to BOTH table and JSONB;
  **reads still come from JSONB.**
- **P2 — Switch reads.** Compose `media.gallery` / `media.featuredImage` / `media.archivedGallery` from
  the table at the read boundary. The API response shape is unchanged (§6), so read-site consumers are
  untouched. Keep writing both during the window for rollback safety.
- **P3 — Retire JSONB fields.** Drop `gallery`, `featuredImage`, `archivedGallery` from the `MediaSchema`
  / `media` blob (videos remain). Stop writing the blob for those fields.

Two carriles per project convention: structural (table) via `db:generate`/`db:migrate`; extras
(partial unique index + CHECK) hand-written, idempotent, re-applied by `db:apply-extras`.

## 6. API contract (D5)

- **READ stays stable.** The response keeps exposing `media.gallery` / `media.featuredImage`, composed
  from the table. The ~21 accommodation read-sites in `apps/web`/`apps/admin` (and shared
  `apps/web/src/lib/media.ts`, `transforms.ts`) are untouched.
- **Admin WRITE migrates** from a blob `PATCH media` to granular endpoints:
  `add` / `remove` / `reorder` / `setFeatured` / `archive` / `restore`.
- **SPEC-167 primitives change** from JSONB read-modify-write to `UPDATE … SET state` by `id`
  (`archiveAccommodationPhotos` / `restoreAccommodationPhotos` in
  `apps/api/src/services/plan-photo-restriction.service.ts`).
- **`enforcePhotoLimit`** counts rows `WHERE state='visible'` instead of parsing JSONB
  (`apps/api/src/middlewares/limit-enforcement.ts`).

## 7. Affected surfaces

- `packages/db/src/schemas/accommodation/` — new `accommodation_media.dbschema.ts` (+ relation to
  `accommodations`).
- `packages/db/src/models/` — new `accommodationMedia.model.ts` extending `BaseModel`.
- `packages/schemas/src/common/media.schema.ts` — keep `MediaSchema` for read composition; add an
  `AccommodationMediaItem` schema mirroring `ImageSchema` + `state`/`is_featured`/`sort_order`.
- `packages/schemas/src/entities/accommodation/accommodation.schema.ts` — `AccommodationEntityMediaFields`
  evolves through the transition (P3 drops the retired fields).
- `apps/api/src/services/accommodation*.service.ts` — compose reads from the table; granular writes.
- `apps/api/src/middlewares/limit-enforcement.ts` — `enforcePhotoLimit` counts rows.
- `apps/api/src/services/plan-photo-restriction.service.ts` — archive/restore via `state` flip + FIFO
  on `archived_at`.
- Migrations — structural (table) + extras (partial unique index + CHECK).
- `packages/seed/` — seed accommodation media into the table.
- Admin write UI — migrate from blob PATCH to the granular endpoints.

## 8. Reusability — table-per-entity pattern (out of scope to apply, in scope to enable)

Six entities share the identical `BaseMediaFields` JSONB shape (accommodation, destination, post, event,
gastronomy, experience). To avoid 6 near-duplicate redesigns later, the table/columns and model are built
as a **reusable shape** (a shared column helper + a parametrized `BaseMediaModel`) so a future
`destination_media` / `post_media` / etc. is *instantiate the pattern*, not *design a new table*. **Only
accommodation is migrated in THIS spec.** The accommodation-exclusive bits (`archivedGallery` semantics,
`MAX_PHOTOS_PER_ACCOMMODATION` billing limit) stay accommodation-specific.

## 9. Out of scope

- The other five gallery entities (destination, post, event, gastronomy, experience) — future specs
  reusing the §8 pattern. No code for them here.
- **Videos** — stay in the `media` JSONB (D1).
- Single-image entities (user avatar, `postSponsor.logo`, `eventOrganizer.logo`) — not galleries.
- Any polymorphic or M:N / shared-media model (rejected in §2).
- Changing how moderation works (per-image `moderation_state` is reused as-is).

## 10. Constraints

- Branch from `staging`, PR to `staging`, own worktree
  (`spec-204-accommodation-gallery-relational-migration`).
- **Dual-write transition window** — no big-bang cutover (§5); each phase independently shippable.
- **No data loss** — every row mirrors `ImageSchema` EXACTLY, including `public_id` + `attribution`.
- Two-carril migration (structural + extras); run `db:apply-extras` after `db:migrate`.
- Not on the critical path (post billing go-live, SPEC-193). SPEC-167's `archivedGallery` JSONB mechanism
  remains functional throughout the interim.

## 11. Cross-references

- **depends_on SPEC-167** (completed + archived) — `archivedGallery` in JSONB is the interim mechanism
  this spec replaces with the `state='archived'` row. Origin: SPEC-167 realign D-2 follow-up
  (owner 2026-06-06).
- relates_to SPEC-186.
- Inventory backing §2/§8: Explore audit 2026-06-22 (6 entities share `BaseMediaFields`; no relational
  media table exists today; `ImageSchema.moderationState` is uniform across all entities).

## Revision History

| Date | Trigger | Changes | Result |
|------|---------|---------|--------|
| 2026-06-06 | SPEC-167 realign D-2 | Spec spun off as a 2KB scope-sketch | draft created |
| 2026-06-22 | Formalization (owner) | Locked D1 (table scope, videos stay JSONB), D2 (state enum + is_featured, partial unique index + CHECK), D3 (uuid PK, sort_order, archived_at, mirror ImageSchema), D4 (3-phase dual-write), D5 (stable reads, granular admin writes), D6 (storage model = direct table-per-entity, polymorphic + junction rejected). Added §8 reusable pattern. | spec formalized, ready for task-from-spec |

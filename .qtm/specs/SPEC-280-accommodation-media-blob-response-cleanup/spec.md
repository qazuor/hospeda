---
spec-id: SPEC-280
title: "Accommodation media: remove composed blob shape from API responses"
type: refactor
complexity: high
status: draft
created: 2026-06-24T00:00:00Z
depends_on: [SPEC-204]
priority: low
base: staging
---

# SPEC-280: Accommodation media: remove composed blob shape from API responses

> **Draft 2026-06-24.** Absorbs SPEC-204 T-025 + T-028 (deferred by owner decision when SPEC-204
> closed: API compat kept, schema retirement deferred). Work is gated on SPEC-204 being merged to
> staging.

## 1. Problem

After SPEC-204, `accommodation_media` is the canonical source of truth for accommodation photos.
However, the API still **composes a synthetic `media.featuredImage` / `media.gallery` /
`media.archivedGallery` object** inside accommodation responses — reading from the relational table
at query time and reconstructing the old JSONB shape for backward compatibility. Many read-clients
depend on this composed shape:

- **`apps/web/src/lib/api/transforms.ts`** — `processEntityImages` / `transformAccommodationMedia`
  consume `media.featuredImage.url` and `media.gallery[]`.
- **`apps/web/src/lib/media.ts`** — `extractFeaturedImage` / `extractGalleryUrls` read the blob shape.
- **`apps/admin/src/features/accommodations/config/score-signals.ts`** — reads
  `media.featuredImage.url` and `media.gallery` for quality-signal scoring. Silently degrades
  (wrong score) if not migrated.
- **`apps/admin/src/features/accommodations/config/columns.factory.ts`** — `featuredImageColumn` /
  `mediaGalleryColumn` read from the blob shape.
- **`apps/admin/src/features/accommodations/config/accommodations.config.ts`** — peek / preview
  references the blob shape.

This composed shape is **schema debt**: the response models a structure (`gallery[]`,
`featuredImage`, `archivedGallery[]`) that no longer exists as data in the database. Keeping it
means:

- The `MediaSchema` (and `AccommodationEntityMediaFields` / `HttpMediaSchema`) in `@repo/schemas`
  must continue carrying the retired photo fields even though the DB has no corresponding columns.
- Any new consumer is likely to read the blob instead of the `AccommodationMedia[]` list endpoint,
  re-introducing the JSONB-era fragility.
- The `archivedGallery` field on the blob remains an accommodation-specific workaround shape that
  should never have been a schema concern.

## 2. Goal

1. **Remove the composed `media.featuredImage` / `media.gallery` / `media.archivedGallery`** from
   accommodation public / protected / admin API responses.
2. **Migrate ALL read-clients** listed in §1 to consume either:
   - The raw `AccommodationMedia[]` list (from `GET /api/v1/…/accommodations/:id/media`), or
   - A new first-class `media` list field on the accommodation response (`AccommodationMedia[]`).
3. **Retire the photo fields** (`featuredImage`, `gallery`, `archivedGallery`) from
   `MediaSchema` / `AccommodationEntityMediaFields` / `HttpMediaSchema` in `@repo/schemas`.
   Videos stay in the JSONB-backed `videos` field — those are out of scope.
   Create an accommodation-specific videos-only media schema, leaving the shared
   `BaseMediaObjectSchema` intact for the other five gallery entities (destination, event, post,
   gastronomy, experience) which still use JSONB for photos.
4. **Fix the resulting type fallout** across web, admin, and API.
5. **Full post-retirement lifecycle regression test** (the deferred SPEC-204 T-028): end-to-end —
   create accommodation, add/reorder/setFeatured/archive/restore photos, downgrade restrict/restore
   (SPEC-167 primitives), enforce limit, read shape stable, JSONB has no gallery keys.

## 3. Scope boundary

### In scope

- Remove composed blob from accommodation API responses (all three tiers: public, protected, admin).
- Migrate all read-clients listed in §1 above.
- Retire `featuredImage` / `gallery` / `archivedGallery` from `MediaSchema` /
  `AccommodationEntityMediaFields` / `HttpMediaSchema` in `@repo/schemas`.
- Extras-carril idempotent SQL to strip the retired keys from existing `accommodations.media` JSONB
  (keep videos) — originally SPEC-204 T-026.
- Full lifecycle regression test (originally SPEC-204 T-028).
- Fix all type fallout (typecheck clean on web + admin + api + schemas + service-core).

### Out of scope

- The other five gallery entities (destination, event, post, gastronomy, experience) — they still
  use JSONB for photos and are handled by future specs using the SPEC-204 §8 reusable pattern.
- Videos — stay in `media.videos` JSONB. No change.
- The relational `accommodation_media` table itself, its model, or its granular API endpoints
  (those are SPEC-204 scope, already shipped).
- Any change to the moderation system.

## 4. Riskiest migration sites

Ordered by blast radius:

1. **Admin score-signals** (`score-signals.ts`) — silently produces wrong quality scores if
   `media.featuredImage.url` / `media.gallery` stop being present without a corresponding update.
   This is the highest-risk site: no runtime error, just silent data quality degradation.
2. **Web transforms** (`transforms.ts`, `media.ts`) — failures here break accommodation listing
   cards and detail pages (visible to all users, high traffic).
3. **`columns.factory.ts`** and **`accommodations.config.ts`** in admin — table columns and preview
   break for admin users.
4. **API response contract** — any external consumer that parses the accommodation JSON would need
   a migration (not applicable for this internal-only platform, but the compat window must be
   documented).

## 5. Affected surfaces

- `packages/schemas/src/common/media.schema.ts` — retire `featuredImage`/`gallery`/`archivedGallery`
  from `MediaSchema`/`AccommodationEntityMediaFields`/`HttpMediaSchema`; add accommodation-specific
  videos-only variant.
- `apps/api/src/services/accommodation*.service.ts` — remove blob composition from response helpers.
- `apps/web/src/lib/api/transforms.ts` — migrate from blob to `AccommodationMedia[]`.
- `apps/web/src/lib/media.ts` — migrate helpers to read from `AccommodationMedia[]`.
- `apps/admin/src/features/accommodations/config/score-signals.ts` — migrate to `AccommodationMedia[]`.
- `apps/admin/src/features/accommodations/config/columns.factory.ts` — migrate gallery/featured columns.
- `apps/admin/src/features/accommodations/config/accommodations.config.ts` — migrate peek/preview.
- `packages/db/src/migrations/extras/` — idempotent SQL to strip gallery/featuredImage/archivedGallery
  keys from existing `accommodations.media` JSONB rows (keep `videos`).
- Tests — full lifecycle regression (SPEC-204 T-028 scope).

## 6. Constraints

- Branch from `staging`, PR to `staging`, own worktree. **MUST NOT start before SPEC-204 is merged.**
- No data loss — `accommodation_media` rows are the source of truth; JSONB strip is a cleanup only.
- Two-carril migration as needed (structural changes via `db:generate`/`db:migrate`; JSONB strip via
  `db:apply-extras`).
- The `accommodation_media` granular API endpoints (`GET /media`, `POST /media`, etc.) remain
  untouched — this spec only removes the blob composition layer from the main accommodation response.

## 7. Absorbed tasks from SPEC-204

| SPEC-204 task | Status in SPEC-204 | What it becomes here |
|---|---|---|
| **T-025** — Retire gallery/featuredImage/archivedGallery from MediaSchema | deferred | §3 schema retirement (full scope) |
| **T-026** — Data migration: drop retired keys from JSONB | deferred from T-025 | §5 extras-carril JSONB strip |
| **T-028** — Regression test: full lifecycle post-retirement | deferred from T-025/T-026 | §3 lifecycle regression test |

T-026 was left in SPEC-204 state as "completed" because it was originally separate from T-025
(it blocked on T-025, which was deferred). In this spec it is absorbed as a deliverable of the
schema retirement track.

## 8. Cross-references

- **depends_on SPEC-204** (in-progress) — must merge before SPEC-280 can start.
- SPEC-204 §6 API contract: the compat shape being removed here was a deliberate interim decision
  documented in SPEC-204 D5.
- SPEC-204 §8 reusable pattern: the five other entities' migrations are separate future specs.

## Revision History

| Date | Trigger | Changes | Result |
|------|---------|---------|--------|
| 2026-06-24 | SPEC-204 closeout deferral (T-025 + T-028) | Spec created, absorbs deferred SPEC-204 tasks | draft created |

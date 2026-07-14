---
title: POI categories model (M2M catalog, replaces single `type` enum)
linear: HOS-139
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - db
  - api
---

# POI categories model (M2M catalog, replaces single `type` enum)

> **Depends on**: HOS-138 (POI v2 model core) — this spec adds new tables that
> reference `points_of_interest`, and reuses the deprecated-transitional
> `type` column HOS-138 documents (§6.6 there). **Blocks**: the future
> thematic-filters, AI-itinerary, and commerce-bridge issues (`[J]`/`[L]`/`[M]`
> in the approved plan `/home/qazuor/.claude/plans/functional-prancing-rabin.md`),
> none of which are filed as their own `HOS-N` issues yet.
> **Sibling**: HOS-140 (destination-relation column) — independent of this
> spec, both depend only on HOS-138.

## 1. Summary

HOS-113's `points_of_interest.type` is a single closed 9-value enum — one
category per landmark. The 914-POI dataset carries **40 real-world
categories**, and landmarks routinely belong to more than one (a winery that
is also a restaurant; a historic building that is also a museum). A
single-column enum cannot express that. This spec introduces a proper
many-to-many category model: a new editable `poi_categories` catalog table
(multilang name, icon, ordering) and a join table `r_poi_category` marking
exactly one category per POI as `isPrimary`. It seeds the 40 categories (with
multilang names) and a documented mapping from the 9 legacy `type` values to
their nearest new category, used to backfill the 12 existing seeded POIs so
every POI has at least a primary category from day one.

## 2. Problem

- `PointOfInterestTypeEnum` (`packages/schemas/src/enums/point-of-interest-type.enum.ts:16-26`)
  is a **closed, single-value enum**: `BEACH | STADIUM | PARK | MUSEUM | PLAZA
  | MONUMENT | VIEWPOINT | NATURAL | OTHER`. The new dataset's 40 categories
  (`HISTORIC_SITE`, `RECREATION`, `TOURIST_ROUTE`, `NATURAL_AREA`,
  `EDUCATION`, `CULTURAL_CENTER`, `SERVICES`, `PARK`, `WATERFRONT`,
  `SPORTS_VENUE`, `ARCHITECTURE`, `COMMUNITY_CENTER`, `FAMILY`, `MONUMENT`,
  `ENTERTAINMENT`, `INDUSTRIAL_HERITAGE`, `MUSEUM`, `FAIR`, `TRANSPORT`,
  `BIRDWATCHING`, `GASTRONOMY`, `SQUARE`, `RELIGIOUS_SITE`, `BEACH`, `HIKING`,
  `GOVERNMENT`, `VIEWPOINT`, `ART`, `SHOPPING`, `RESERVE`, `CAMPGROUND`,
  `HEALTH`, `PORT`, `THEATER`, `NIGHTLIFE`, `THERMAL_COMPLEX`, `WELLNESS`,
  `WINERY`, `CASINO`, `OTHER`) are both a superset (only 9 of 40 overlap
  conceptually) and inherently multi-valued per POI. Growing the existing enum
  to 40 values would still cap every POI at exactly one category, which is
  factually wrong for a meaningful share of the dataset (e.g. `WINERY` +
  `GASTRONOMY` co-occur constantly).
- The category catalog needs to be **editable without a redeploy** — new
  categories will be added as the content team encounters new landmark kinds,
  and a hardcoded enum requires a schema migration + code deploy for every
  addition. A real table (like `attractions`, which is also an editable
  M2M-linked catalog) is the correct shape.
- `PointOfInterestService`'s own search-where builder explicitly documents
  that POI has no `destinationId` column and filters via the join table
  instead (`packages/service-core/src/services/point-of-interest/point-of-interest.service.ts:482-540`)
  — the same "filter through the join, not a column" pattern is needed here:
  `buildSearchWhere` (lines 494-504) currently treats `type` as a plain
  column filter; once category becomes the real taxonomy, a "POIs in
  category X" query must go through `r_poi_category`, not a column on
  `points_of_interest`.

## 3. Goals

- **G-1** New table `poi_categories`: an editable catalog with multilang
  `nameI18n` (not i18n-by-slug — see §6.1 for why this differs from HOS-113's
  `type` display pattern), `icon`, `displayWeight`, standard `BaseModel`
  lifecycle/audit columns.
- **G-2** New join table `r_poi_category`: `(pointOfInterestId, categoryId)`
  composite PK, both FKs `ON DELETE CASCADE`, plus an `isPrimary` boolean with
  a DB-level guarantee that at most one row per `pointOfInterestId` has
  `isPrimary = true`.
- **G-3** Seed the 40 categories with multilang names (es authoritative, en/pt
  translated) and displayWeight/icon values.
- **G-4** A documented mapping from the 9 legacy `PointOfInterestTypeEnum`
  values to their corresponding new category slug (§7.4), used to backfill
  `r_poi_category` for the 12 existing seeded POIs so every one of them has a
  primary category immediately, without waiting for the future bulk import.
- **G-5** A `PointOfInterestCategoryService` (or equivalent — see §6.4 for the
  naming decision) providing catalog CRUD plus assign/unassign/set-primary
  operations on the join, mirroring `PointOfInterestService`'s own
  relation-management method shapes
  (`addPointOfInterestToDestination`/`removePointOfInterestFromDestination`,
  `point-of-interest.service.ts:187-326`).
- **G-6** New `PermissionEnum` values for the category catalog, separate from
  `POINT_OF_INTEREST_*` (mirroring how `attractions`/`amenities` each own
  their own permission set rather than reusing accommodation's).
- **G-7** Keep `points_of_interest.type` synced from the primary category
  (HOS-138 R-4) via a lossy category-slug → enum reverse mapping (§7.6),
  written transactionally by the service on every primary-category change, so
  existing `type` consumers keep working unchanged. **In scope per the
  2026-07-13 scope decision** (Revision History).

## 4. Non-goals

- **NG-1** Migrating the `type`-keyed *consumers* to read categories directly.
  This spec keeps `points_of_interest.type` **populated and correct** by syncing
  it from the primary category (§6.5/§7.6, in scope per the 2026-07-13 scope
  decision — Revision History), so the existing consumers (search filter,
  `poi-labels.ts`'s type badge, `DestinationPOISection.astro`'s badge render)
  keep working unchanged against a `type` value that now always reflects the
  real primary category. **Rewriting those consumers** to read `r_poi_category`
  instead of `type` is the follow-up (the plan's `[J]` thematic-filters +
  consumer-migration pass), NOT this spec. See OQ-2.
- **NG-2** Admin CRUD HTTP routes or an admin UI screen for managing
  categories. This spec ships the table, seed, and service only — the plan's
  Fase 1 "CRUD API admin de POIs"/"CRUD admin UI de POIs" work (not yet its
  own `HOS-N` issue) is where routes land, mirroring HOS-113's own precedent
  of shipping a read+write-capable service ahead of any exposed route
  (HOS-113 §6.5/NG-5).
- **NG-3** Public read routes for the category catalog (e.g. `GET
  /api/v1/public/poi-categories`). Deferred to the thematic-filters issue
  (`[J]` in the plan), which is the actual consumer.
- **NG-4** Importing the 914-POI dataset's actual category assignments. Only
  the 12 existing seeded POIs are backfilled here (G-4); the bulk import is
  issue `[E]`, out of scope, and depends on this spec.
- **NG-5** Multi-select category UI in the admin `I18nTextField`-driven POI
  form. That is the admin-UI issue's scope (`[G]` in the plan), not this one.

## 5. Current baseline

Verified against the working tree 2026-07-11:

- **`type` today**: a single pgEnum column
  (`PointOfInterestTypePgEnum('type').notNull()`,
  `packages/db/src/schemas/destination/point-of-interest.dbschema.ts:33`),
  backed by `PointOfInterestTypeEnum`
  (`packages/schemas/src/enums/point-of-interest-type.enum.ts:16-26`) and its
  Zod wrapper `PointOfInterestTypeEnumSchema`
  (`packages/schemas/src/enums/point-of-interest-type.schema.ts`). Indexed
  (`pointsOfInterest_type_idx`, `point-of-interest.dbschema.ts:56`).
- **Display today is i18n-by-slug/enum-value, NOT data-driven**:
  `apps/web/src/lib/poi-labels.ts:63-72`'s `translatePoiTypeLabel({t, type})`
  resolves `destinations.poiTypeLabels.<TYPE>` from a static i18n string file
  — adding a category requires a code change + redeploy under this pattern.
  This spec's new `poi_categories.nameI18n` is deliberately **data-driven**
  instead (§6.1) — an admin can rename or add a category without touching
  `@repo/i18n` at all.
- **`PointOfInterestService.buildSearchWhere`**
  (`point-of-interest.service.ts:494-504`) treats `type` as a plain
  equality filter merged into the model's `where` object. There is no
  equivalent path today for "POIs tagged with category X" — that requires a
  join through a new table this spec introduces.
- **M2M join precedent**: `r_destination_point_of_interest`
  (`packages/db/src/schemas/destination/r_destination_point_of_interest.dbschema.ts:12-32`)
  is the closest existing precedent for a POI-referencing join table:
  composite PK via `primaryKey({columns: [...]})`, both FKs
  `onDelete: 'cascade'`, an index on the composite pair plus a second index on
  the second FK column alone (for the reverse-direction lookup). This spec's
  `r_poi_category` mirrors that shape, with one addition: the `isPrimary`
  per-group invariant (§6.2).
- **Existing 12 seeded POIs' `type` values** (from
  `apps/api/src/routes/ai/protected/poi-allowlist.ts`'s inline comments,
  cross-checked against the seed fixtures): `001`=STADIUM, `002`=BEACH,
  `003`=MUSEUM, `004`=MONUMENT, `005`=PARK, `006`=NATURAL, `007`=PLAZA,
  `008`=VIEWPOINT, `009`=OTHER, `010`=BEACH, `011`=PARK, `012`=OTHER — all 9
  enum values are represented across the 12 fixtures.
- **Permission precedent**: `POINT_OF_INTEREST_*` permissions already exist
  (`packages/schemas/src/enums/permission.enum.ts:518-524`:
  `POINT_OF_INTEREST_CREATE/UPDATE/DELETE/VIEW/RESTORE/LIFECYCLE_CHANGE/
  HARD_DELETE`) plus a distinct
  `DESTINATION_POINT_OF_INTEREST_MANAGE` (line 196) for the relation-to-
  destination action. This spec follows the same shape for the new category
  catalog's own permission set (§7.3).
- **Drizzle partial-index support**: Drizzle Kit's pg-core supports
  `uniqueIndex(name).on(col).where(sql\`...\`)` for partial unique indexes,
  which is declarable in Carril 1 (structural, `db:generate`-generated) — it
  does NOT require the extras carril the way a CHECK constraint would (per
  `packages/db/CLAUDE.md`'s golden-rule table: "normal index" is a Carril 1
  concern, and a partial unique index is still an index, not a
  cross-column CHECK).

## 6. Proposed design

### 6.1 `poi_categories` — data-driven multilang catalog, not i18n-by-slug

Unlike `type` (a closed, code-defined enum whose labels resolve through
`@repo/i18n`), `poi_categories` rows carry their own `nameI18n` content
directly, mirroring `destinations.nameI18n` rather than `amenities`/
`attractions`' i18n-by-slug pattern. This is a deliberate difference from
HOS-113's `type` precedent:

**Alternatives considered:**

1. **i18n-by-slug, like `type`/`amenities`/`features`** (add
   `destinations.poiCategoryNames.<slug>` string-file entries). Rejected:
   the whole reason this table exists is that categories must be an
   **admin-editable catalog** — a content operator adding "birdwatching" as a
   41st category should not need an engineer to add an i18n string file entry
   and redeploy. A closed enum's i18n-by-slug pattern is correct for a closed
   set; this is explicitly not a closed set.
2. **(Chosen) `nameI18n` jsonb content directly on the row**, mirroring
   `destinations`. Lets an admin create/rename a category through the same
   `I18nTextField.tsx` (with its AI auto-translate action) already used for
   destination content — no i18n file involvement.

Table `poi_categories`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid PK` | |
| `slug` | `text UNIQUE NOT NULL` | Machine identifier only (NOT an i18n key) — e.g. `winery`, `gastronomy`. |
| `nameI18n` | `jsonb NOT NULL` | `$type<I18nText>()` — required, every category must have a display name. |
| `translationMeta` | `jsonb NULL DEFAULT '{}'` | `$type<TranslationMeta>()`, same SPEC-212 convention. |
| `icon` | `text NULL` | |
| `displayWeight` | `integer NOT NULL DEFAULT 50` | Ordering within a POI's category badge list / a future filter UI. |
| `lifecycleState` | enum | standard, default `ACTIVE`. |
| `adminInfo`, `createdAt/By`, `updatedAt/By`, `deletedAt/By` | `BaseModel` | |

### 6.2 `r_poi_category` — join with an enforced single-primary invariant

| Column | Type | Notes |
| --- | --- | --- |
| `pointOfInterestId` | `uuid NOT NULL` | FK → `points_of_interest.id`, `ON DELETE CASCADE`. |
| `categoryId` | `uuid NOT NULL` | FK → `poi_categories.id`, `ON DELETE CASCADE`. |
| `isPrimary` | `boolean NOT NULL DEFAULT false` | |

- **PK**: composite `(pointOfInterestId, categoryId)` — a POI cannot be
  assigned the same category twice, mirroring
  `r_destination_point_of_interest`'s exact PK shape.
- **Indexes**: composite `(pointOfInterestId, categoryId)` (mirrors the join
  precedent's dual-direction index) plus a standalone index on `categoryId`
  for the reverse "which POIs have category X" lookup (thematic filters,
  `[J]`, out of scope but the index is cheap to add now).
- **Single-primary invariant**: a **partial unique index**
  `r_poi_category_primary_idx UNIQUE (pointOfInterestId) WHERE is_primary =
  true` — guarantees at most one `isPrimary = true` row per POI at the
  database level, declarable directly in the Drizzle table definition (no
  extras-carril CHECK needed, per §5's Drizzle partial-index note). A POI
  with zero category rows (not yet categorized) is valid and has no primary;
  a POI with one or more category rows MUST have exactly one marked primary
  before it is considered "categorized" (enforced at the **service** layer —
  see §6.4 — since the partial unique index only prevents *more than one*
  primary, not *zero* primaries among a non-empty set; a true "at least one
  primary once any row exists" invariant is a cross-row business rule the DB
  cannot express without a trigger, and this spec does not introduce one).

**Alternatives considered:**

1. **App-level-only enforcement** (the service always sets exactly one
   `isPrimary = true` on assign, never enforced by the DB). Rejected as the
   sole mechanism: a future direct-seed bug, a race between two concurrent
   assign calls, or a manual DB fix could silently create two primaries with
   no defense in depth.
2. **(Chosen) Partial unique index for the "at most one" half, service-layer
   enforcement for the "at least one once non-empty" half.** The DB catches
   the dangerous case (silent duplicate primary corrupting every "the
   category" query); the service layer, which already validates on every
   assign/unassign call, is the natural place for the softer "keep exactly
   one" business rule (e.g. auto-promoting the next remaining category to
   primary when the current primary is unassigned).

### 6.3 Category seed: 40 categories + legacy `type` mapping (§7.4)

Seed all 40 dataset categories as `poi_categories` rows (multilang `nameI18n`,
a curated `icon`, and a `displayWeight` reflecting rough frequency/importance
in the dataset — exact values are an implementation-time content decision,
not specified here). Separately, seed `r_poi_category` rows for the 12
existing POIs using the legacy-`type` → new-category mapping table (§7.4),
each marked `isPrimary = true` (single row per POI, satisfying §6.2's
invariant trivially since there is exactly one row each).

### 6.4 Service: category CRUD + POI assignment

A new service (name: `PointOfInterestCategoryService`, chosen over a shorter
`PoiCategoryService` for naming consistency with the existing
`PointOfInterestService` — both spell out "PointOfInterest" in full, no
existing service in the codebase abbreviates to "Poi") extending
`BaseCrudService` for the catalog's own CRUD (create/update/delete/restore/
list/search a `poi_categories` row — same 12-method permission-hook shape
documented in `packages/service-core/CLAUDE.md`), plus dedicated methods for
the join, mirroring `PointOfInterestService`'s existing
`addPointOfInterestToDestination`/`removePointOfInterestFromDestination`
shape (`point-of-interest.service.ts:187-326`) exactly:

- `assignCategoryToPointOfInterest(actor, {pointOfInterestId, categoryId,
  isPrimary?}, ctx)` — creates the join row. If `isPrimary: true` is passed
  and the POI already has a different primary, the existing primary's row is
  flipped to `isPrimary: false` in the same transaction (never two primaries
  simultaneously, reinforcing §6.2's DB constraint rather than racing
  against it).
- `unassignCategoryFromPointOfInterest(actor, {pointOfInterestId,
  categoryId}, ctx)` — soft-deletes/removes the join row. If the removed row
  was the primary and other category rows remain for that POI, the service
  promotes the next-highest-`displayWeight` remaining category to primary
  (§6.2's "at least one once non-empty" service-layer rule) — this
  auto-promotion behavior is confirmed as OQ-1.
- `setPrimaryCategory(actor, {pointOfInterestId, categoryId}, ctx)` —
  explicit primary re-assignment among a POI's already-assigned categories
  (flips the old primary off, the new one on, in one transaction).

Every method above that changes which category is primary (`assign` with
`isPrimary: true`, `setPrimaryCategory`, and `unassign`'s auto-promotion path)
also writes the derived `points_of_interest.type` in the **same transaction**,
per §6.5/§7.6 — the sync is a service-layer responsibility, never a separate
call the caller can forget.

- `getCategoriesForPointOfInterest(actor, {pointOfInterestId}, ctx)` /
  `getPointsOfInterestForCategory(actor, {categoryId}, ctx)` — read-side
  mirrors of `PointOfInterestService.getPointsOfInterestForDestination`/
  `getDestinationsByPointOfInterest` (`point-of-interest.service.ts:335-437`).

### 6.5 `type` is synced from the primary category (HOS-138 R-4, now in scope)

Per the 2026-07-13 scope decision (Revision History), this spec **owns** keeping
`points_of_interest.type` in agreement with the POI's primary category — the
HOS-138 R-4 derivation, brought into scope here rather than deferred. The
`PointOfInterestCategoryService` writes `type` in the **same transaction** as
every operation that changes which category is primary (`assign` with
`isPrimary: true`, `setPrimaryCategory`, and the auto-promotion path in
`unassign`), using the **category-slug → `type` reverse mapping** in §7.6.

Because `type` is a closed 9-value enum and categories are an open 40+ set, the
derivation is **lossy by construction**: the 9 categories with a direct enum
equivalent map back to that value; every other category (`winery`, `gastronomy`,
`religious_site`, …) derives to `OTHER`. `type` therefore stays a valid,
populated enum value at all times — never `null`, never an enum-invalid
string — so every existing `type` consumer keeps working with no code change. A
POI with **zero** categories keeps whatever `type` it already had (the sync only
fires when a primary exists); this spec never writes `null` to the `NOT NULL`
column.

`PointOfInterestService.buildSearchWhere`'s existing `type` filter branch
(`point-of-interest.service.ts:494-504`) is **unchanged** — the new
`categoryId`/`categorySlug` filter (§7.2) is additive, joining through
`r_poi_category`, alongside (not replacing) the `type` filter. See §7.2 and OQ-2
for the eventual consumer sunset path.

## 7. Data model / contracts

### 7.1 DB migration (Carril 1 — structural)

`pnpm db:generate` → next sequential migration after HOS-138's `0052_*`
(this spec's own number depends on merge order relative to HOS-138 and
HOS-140; both are additive `CREATE TABLE`s and do not conflict). Two new
tables: `poi_categories` (unique index on `slug`, the columns in §6.1) and
`r_poi_category` (composite PK, the two supporting indexes plus the partial
unique index, per §6.2).

### 7.2 Zod (`@repo/schemas`)

New entity directory `packages/schemas/src/entities/poi-category/`, the
standard 6-file set mirroring `attraction/` (`.schema.ts`, `.crud.schema.ts`,
`.query.schema.ts`, `.http.schema.ts`, `.access.schema.ts`, `index.ts`):
`PoiCategorySchema` (`id`, `slug`, `nameI18n: I18nTextSchema`,
`translationMeta: TranslationMetaSchema.nullish()`, `icon?`, `displayWeight`,
lifecycle/admin/audit fields), `PoiCategoryCreateInputSchema`/
`UpdateInputSchema`, `PoiCategorySearchInputSchema`.

Relation schemas (mirroring
`packages/schemas/src/entities/point-of-interest/point-of-interest.relations.schema.ts`'s
shape): `AssignCategoryToPointOfInterestInputSchema`
(`pointOfInterestId`, `categoryId`, `isPrimary?: boolean.default(false)`),
`UnassignCategoryFromPointOfInterestInputSchema`,
`SetPrimaryCategoryInputSchema`.

`PointOfInterestSearchInputSchema` (existing,
`packages/schemas/src/entities/point-of-interest/point-of-interest.query.schema.ts`)
gains an additive `categoryId`/`categorySlug` optional filter, resolved by
`PointOfInterestService` the same way `destinationId` already is — through
the join table, not a plain column (§6.5).

### 7.3 Permissions (`@repo/schemas` `PermissionEnum`)

New category matching the existing `POINT_OF_INTEREST` category
(`PermissionCategoryEnum`, line 25 area of `permission.enum.ts`):
`POI_CATEGORY_CREATE`, `POI_CATEGORY_UPDATE`, `POI_CATEGORY_DELETE`,
`POI_CATEGORY_VIEW`, `POI_CATEGORY_RESTORE`, `POI_CATEGORY_HARD_DELETE` —
mirroring the exact naming/value convention of `POINT_OF_INTEREST_*`
(`permission.enum.ts:518-524`). The assign/unassign/set-primary methods reuse
these (create≈assign, delete≈unassign, update≈set-primary) rather than
minting a fifth "manage assignment" permission — consistent with how
`PointOfInterestService._canAddPointOfInterestToDestination` already reuses
`checkCanCreatePointOfInterest` instead of a dedicated relation permission
(`point-of-interest.service.ts:160-165`).

### 7.4 Legacy `type` → new category mapping (used for the 12-POI backfill only)

| Legacy `PointOfInterestTypeEnum` | New category `slug` | Rationale |
| --- | --- | --- |
| `BEACH` | `beach` | Identical concept, present in both taxonomies. |
| `STADIUM` | `sports_venue` | New taxonomy renamed this to the broader `SPORTS_VENUE`. |
| `PARK` | `park` | Identical concept. |
| `MUSEUM` | `museum` | Identical concept. |
| `PLAZA` | `square` | New taxonomy uses `SQUARE` for this concept. |
| `MONUMENT` | `monument` | Identical concept. |
| `VIEWPOINT` | `viewpoint` | Identical concept. |
| `NATURAL` | `natural_area` | Closest general-purpose match; `reserve` is reserved for POIs that are specifically a protected reserve, a narrower case the 12 existing POIs do not need (none of them are a formal reserve). |
| `OTHER` | `other` | Identical concept. |

This mapping is a one-time backfill tool for the 12 existing POIs (§6.3); it
is documented here so the future bulk-import issue (`[E]`, out of scope) can
reuse it verbatim for any dataset row whose only available signal is a
legacy-shaped `type` value, without re-deriving the mapping from scratch.

### 7.5 Seed / dual-write (HOS-25)

Same-PR dual write:

1. **Baseline**: new `packages/seed/src/required/poiCategories.seed.ts` +
   40 fixture files under `packages/seed/src/data/poiCategory/*.json` +
   `manifest-required.json` `poiCategories` entry. A second seed step (or an
   extension of the existing `pointsOfInterest.seed.ts` relationship step,
   mirroring how `attractions.seed.ts` has a separate relationship-seed step)
   creates the 12 `r_poi_category` backfill rows per §7.4's mapping.
2. **Data migration**: `packages/seed/src/data-migrations/00NN-hos-139-poi-categories.ts`
   (next sequential number after HOS-138's `0010-*`) applies the same 40
   categories + 12 backfill assignments to an already-seeded live
   environment, idempotent (skips a category slug or POI-category pair that
   already exists).
3. `scripts/check-seed-dual-write.sh`'s path list gains the new
   `poiCategory` glob (this entity did not exist before this spec).

### 7.6 Category `slug` → legacy `type` reverse mapping (used by the sync, §6.5)

The sync in §6.5 derives `points_of_interest.type` from the primary category's
`slug`. Only the 9 categories with a direct `PointOfInterestTypeEnum` equivalent
map back to a specific enum value (the inverse of §7.4's 9 rows); **every other
category derives to `OTHER`**:

| Primary category `slug` | Derived `type` |
| --- | --- |
| `beach` | `BEACH` |
| `sports_venue` | `STADIUM` |
| `park` | `PARK` |
| `museum` | `MUSEUM` |
| `square` | `PLAZA` |
| `monument` | `MONUMENT` |
| `viewpoint` | `VIEWPOINT` |
| `natural_area` | `NATURAL` |
| every other slug (`winery`, `gastronomy`, `religious_site`, `historic_site`, `art`, `theater`, `other`, …) | `OTHER` |

This is the inverse of §7.4's forward table for the 9 overlapping concepts
(`other` → `OTHER` is covered by the catch-all row). The mapping lives as a
single exported constant (`CATEGORY_SLUG_TO_POI_TYPE` in `@repo/schemas`,
alongside §7.4's forward map) so the service, the seed, and the data migration
derive `type` identically. Because the derivation is **total** (every slug
resolves; unknown → `OTHER`), adding a 41st category later never breaks the
sync — it just derives to `OTHER` until someone extends the map.

## 8. UX / UI behavior

No new UI surface in this spec (NG-2/NG-5). The only indirect UX effect: once
`DestinationPOISection.astro` is updated (in a future consumer-migration pass,
out of this spec's scope per NG-1) to read categories instead of `type`, the
12 existing POIs will already have a valid primary category to display,
because of the §6.3 backfill — this spec's job is to make that future update
possible without also needing a data backfill at that time.

## 9. Acceptance criteria

- **AC-1** `poi_categories` and `r_poi_category` tables exist per §6.1/§6.2;
  the partial unique index enforcing "at most one primary per POI" is present
  and verified by a test that attempts to insert a second `isPrimary = true`
  row for the same POI and asserts the DB rejects it.
- **AC-2** `@repo/schemas` exposes the `poi-category` 6-file set and the three
  relation input schemas (§7.2); `@repo/service-core` exposes
  `PointOfInterestCategoryService` with the methods in §6.4, permission-gated
  per §7.3; ≥90% coverage on the new pure logic (mapping table, primary
  auto-promotion).
- **AC-3** The 40 categories are seeded (baseline + data migration, §7.5) with
  multilang `nameI18n` in `es`/`en`/`pt`.
- **AC-4** All 12 existing seeded POIs have exactly one `r_poi_category` row
  marked `isPrimary = true`, matching §7.4's mapping table, on both a fresh
  `db:fresh-dev` DB and a pre-existing seeded DB run through
  `db:seed:migrate`.
- **AC-5** `assignCategoryToPointOfInterest` with `isPrimary: true` correctly
  demotes any pre-existing primary for that POI in the same transaction — a
  dedicated test asserts exactly one primary remains after the call.
- **AC-6** `unassignCategoryFromPointOfInterest` on a POI's current primary,
  when other categories remain assigned, promotes the next-highest-
  `displayWeight` remaining category to primary (OQ-1's confirmed behavior) —
  a dedicated test covers this.
- **AC-7** `PointOfInterestSearchInputSchema`'s new `categoryId`/
  `categorySlug` filter returns only POIs actually joined to that category via
  `r_poi_category`, verified with a service-level test using at least two
  POIs in different categories.
- **AC-8** `points_of_interest.type` is synced from the primary category per
  §6.5/§7.6: (a) `assignCategoryToPointOfInterest` with `isPrimary: true`,
  `setPrimaryCategory`, and the `unassign` auto-promotion path each write the
  derived `type` in the same transaction — a test asserts `type` equals §7.6's
  mapping after each; (b) a primary category with no enum equivalent (e.g.
  `winery`) derives `type = OTHER`; (c) the existing `type`-keyed consumers
  (search filter, `poi-labels.ts`, `DestinationPOISection.astro`'s badge) are
  **unchanged in code** and still work, because `type` remains a valid populated
  enum value at all times — a regression test asserts their behavior is
  unchanged given a synced `type`.

## 10. Risks

- **R-1 "At least one primary" is service-layer-only.** A direct DB insert
  (bypassing the service, e.g. a hand-written data migration) could leave a
  POI with category rows but none marked primary, and nothing at the DB
  level catches it. Mitigation: the seed/data-migration paths (§7.5) are
  written to always set exactly one `isPrimary = true` per POI they touch;
  a future audit query (`SELECT poi_id FROM r_poi_category GROUP BY poi_id
  HAVING count(*) FILTER (WHERE is_primary) = 0`) is documented here as the
  detection tool but not automated in this spec.
- **R-2 40-category seed content is a one-time authoring effort.** Getting
  `nameI18n` es/en/pt right for 40 rows, plus a sensible `icon`/
  `displayWeight` per row, is real content work with no automated check for
  "correctness" (only for structural completeness — AC-3 asserts all three
  locales are present, not that translations read well). Mitigation:
  es is authoritative and reviewable by the content owner; en/pt can be
  iterated post-merge without a schema change.
- **R-3 Confusing two "natural" mappings.** `NATURAL → natural_area` (§7.4)
  is a judgment call, not a 1:1 identity mapping like most of the table —
  a future POI legitimately meant as a `reserve` could be mis-backfilled if
  this mapping is ever reused carelessly outside its documented one-time
  scope. Mitigation: §7.4 explicitly flags this row's rationale so a future
  reader does not treat the table as infallible for the bulk import.
- **R-4 Two independent "primary" concepts across specs.** HOS-140 introduces
  a *destination* relation kind (PRIMARY/NEARBY) on a different join table
  (`r_destination_point_of_interest`) around the same time as this spec's
  *category* `isPrimary`. The two are unrelated concepts that happen to share
  the word "primary" — mitigation: this spec and HOS-140 each scope the term
  precisely (a POI's primary **category** vs. a destination's primary
  **POI-relation kind**) and neither cross-references the other's `isPrimary`/
  `relation` field.

## 11. Open questions

- **OQ-1 (resolved for this spec)** — When a POI's primary category is
  unassigned and other categories remain, should the service auto-promote
  the next one to primary, or leave the POI with zero primaries until a human
  explicitly sets one? **Resolved: auto-promote** (§6.4, AC-6) — leaving a
  POI with assigned-but-no-primary categories would break any future
  "display the POI's primary category badge" consumer with a silent `null`,
  which is worse than a best-guess auto-promotion (by `displayWeight`) that
  an admin can always correct afterward.
- **OQ-2 (resolved 2026-07-13)** When/how does `points_of_interest.type` get
  synced from the primary category (HOS-138 R-4)? **Resolved: in scope for this
  spec** (§6.5/§7.6) — the service writes a lossy-derived `type` (40 categories
  → 9 enum values, non-matching → `OTHER`) in the same transaction as every
  primary-category change, keeping `type` valid and populated so existing
  consumers keep working. The remaining follow-up is only the *consumer
  read-migration* (making `poi-labels.ts`/`DestinationPOISection.astro` read
  `r_poi_category` directly instead of `type`), NG-1 — not the column sync.
- **OQ-3** Should `poi_categories.slug` also carry an `applicableVertical`-like
  scoping column (mirroring the amenity/feature catalog's
  `applicable_verticals text[]`, per root `CLAUDE.md`'s "Amenity/feature
  catalog (SPEC-266)" note), given POI categories could in principle be
  reused beyond pure tourism landmarks (e.g. `GASTRONOMY`/`WINERY` overlapping
  with the commerce catalog, HOS-150 in the plan)? Deferred — no evidence yet
  that POI categories need multi-vertical scoping; revisit if the
  commerce-bridge issue (`[M]` in the plan) actually needs it.

## 12. Implementation notes

Suggested phasing (for Task Master task generation):

1. **DB schema**: `poi_categories` + `r_poi_category` tables + partial unique
   index + migration.
2. **Zod schema**: `poi-category` 6-file set + relation input schemas +
   `PointOfInterestSearchInputSchema`'s additive category filter.
3. **Permissions**: `POI_CATEGORY_*` enum values + permission-check functions.
4. **Service**: `PointOfInterestCategoryService` (catalog CRUD + assign/
   unassign/set-primary + the two read-side list methods), each with its own
   unit tests (AC-5/AC-6 in particular).
5. **Seed**: 40-category fixtures + `poiCategories.seed.ts` + the 12-POI
   backfill relationship step (each backfilled POI's `type` re-derived from its
   primary category via §7.6 so baseline + migration stay consistent) + data
   migration + dual-write guard path update.
6. **`type` sync + regression coverage**: the `CATEGORY_SLUG_TO_POI_TYPE`
   constant (§7.6), the service transactional `type` write on every
   primary-category change (§6.5), and AC-8's tests — both the sync assertions
   and the "consumers unchanged in code, still work" regression.
7. **Quality gate**: `pnpm typecheck`, `@repo/db`/`@repo/schemas`/
   `@repo/service-core` test suites, `check-seed-dual-write.sh`.

Do not start the deferred `type` **consumer read-migration** (NG-1/OQ-2 — making
`poi-labels.ts`/`DestinationPOISection.astro` read `r_poi_category` directly) or
any admin CRUD route work until this spec's service layer is merged and stable.
The `type` **column sync** itself IS in scope here (§6.5) and must not be
deferred.

## 13. Linear

Canonical tracking:
HOS-139

## 14. Revision History

- **2026-07-13 — `type` sync brought into scope (owner decision).** The original
  spec deferred syncing `points_of_interest.type` from the primary category to a
  follow-up (old NG-1/§6.5/OQ-2/AC-8). At implementation start the owner decided
  HOS-139 should OWN the HOS-138 R-4 `type` derivation directly, so the enum
  stays populated/correct while its consumers are migrated later. Changes:
  added G-7; rewrote NG-1 (now only the *consumer read-migration* is deferred),
  §6.5 (sync in scope), §6.4 (service writes `type` transactionally), AC-8 (sync
  assertions instead of "unchanged"), OQ-2 (resolved), §12 phases 5–6; added
  §7.6 (lossy category-slug → `type` reverse mapping, non-matching → `OTHER`).
  The consumer *read-migration* (rewriting `poi-labels.ts` /
  `DestinationPOISection.astro` to read `r_poi_category`) remains out of scope.

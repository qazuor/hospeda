---
title: POI v2 model — core (multilang content, nullable coordinates, curation columns)
linear: HOS-138
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - db
  - api
---

# POI v2 model — core (multilang content, nullable coordinates, curation columns)

> **Depends on**: nothing (foundation). **Blocks**: HOS-139 (categories model),
> HOS-140 (destination-relation column), and the future import/CRUD issues
> ([D]/[E]/[F]/[G] in the approved plan
> `/home/qazuor/.claude/plans/functional-prancing-rabin.md`), which are not yet
> filed as their own `HOS-N` issues at spec-writing time.
> **Extends**: `.specs/HOS-113-points-of-interest/spec.md` (the original POI
> model shipped to staging via PR #2268). This spec assumes HOS-113's schema
> as its baseline and documents deltas against it — read that spec first.

## 1. Summary

HOS-113 shipped a **closed, seed-only POI catalog**: 12 hand-curated landmarks,
`type` as a single closed 9-value enum, `lat`/`long` mandatory, display name
resolved by i18n-by-slug (no `name` column). A richer, ChatGPT-assisted dataset
of **914 POIs across 22 destinations** is available to import next, but it
carries real content (`name` + `description` per POI, not just a display key),
78% of rows with no coordinates yet, curation metadata (`verified`/`source`/
`notes`), and 46 slugs that collide across destinations. HOS-113's model
cannot hold any of this without breaking.

This spec upgrades the `points_of_interest` table to a **v2 shape**: `name`/
`description` become real, admin-editable multilang content (SPEC-212
`I18nText` pattern, matching `destinations`) instead of an i18n-by-slug key;
`lat`/`long` become nullable; `address`, `keywords`, `hasOwnPage`, and four
curation columns (`verified`, `verifiedAt`, `source`, `notes`) are added; the
closed `type` enum is marked **deprecated-transitional** (superseded by the
category M2M model landing in HOS-139, but kept functional until every
consumer migrates). This is the **foundation** all three category/relation/
import work depends on — no new POI data is imported here, only the model and
its existing 12-POI fixtures/consumers are migrated forward.

## 2. Problem

- **`name`/`description` have no data-multilang home.** HOS-113 deliberately
  chose i18n-by-slug (`destinations.poiNames.<slug>`, SPEC-266 pattern) because
  POI was a small, closed, editorially-curated catalog at the time — see
  `.specs/HOS-113-points-of-interest/spec.md` §11 OQ-2. A 914-row catalog with
  real per-POI prose content is the opposite of that: it needs admin-editable
  multilang text rows (like `destinations.name`/`.description`), not a
  redeploy-to-change i18n string file entry per landmark.
- **`lat`/`long` are `NOT NULL`** (`packages/db/src/schemas/destination/point-of-interest.dbschema.ts:31-32`),
  but 717 of 914 dataset rows (78%) have no coordinates yet — a geocoding
  enrichment pipeline is a separate, not-yet-started effort. Blocking the model
  change on 100% geocoding coverage would stall everything downstream.
  `resolvePoiToCoordinates` (`packages/service-core/src/services/accommodation/accommodation.poi-proximity.helper.ts:83-121`)
  and `poi-resolver.ts` (`apps/api/src/routes/ai/protected/poi-resolver.ts:193`)
  both currently assume `lat`/`long` are always numbers once a POI resolves —
  making the columns nullable without touching these call sites introduces a
  silent runtime bug (a `null` fed into `buildWithinRadiusClause`'s numeric SQL
  path).
- **No columns exist for editorial curation metadata.** The dataset ships
  `verified`/`source`/`notes` per row; a future correction/enrichment pipeline
  will need to query `WHERE verified = false` efficiently — that is not
  practical against `adminInfo` jsonb (`BaseAdminFields`), which has no index
  and no typed shape for this.
- **46 slugs in the dataset collide across destinations** (e.g. `municipalidad`
  appears in 16 different towns, `terminal-omnibus` in 13) — they are
  physically distinct landmarks that happen to share a generic name, not one
  POI shared by many destinations (that case is already covered by the
  existing M2M join). The current global `UNIQUE` constraint on `slug`
  (`point-of-interest.dbschema.ts:30`) would reject them as-is.
- **`type` (9-value closed enum) cannot express the dataset's 40 categories**,
  and a POI can legitimately belong to more than one category (a winery that is
  also a restaurant). A single-column enum cannot model that; a real M2M
  category model is needed (HOS-139) — this spec must decide what happens to
  `type` in the interim so the two changes can land independently instead of
  as one large atomic migration.

## 3. Goals

- **G-1** Convert `name`/`description` to the SPEC-212 `I18nText` multilang
  pattern (`nameI18n`, `descriptionI18n`, `translationMeta`), matching
  `destinations`' shape exactly, while keeping the legacy `description` plain
  column and the i18n-by-slug display path working for POIs not yet migrated
  (additive, non-breaking — Schema Compatibility Policy).
- **G-2** Make `lat`/`long` nullable, and fix every consumer that currently
  assumes they are always present so a null-coordinate POI degrades safely
  (never corrupts a SQL numeric path, never crashes a route).
- **G-3** Add `address` (text, nullable), `keywords` (text array, nullable),
  and `hasOwnPage` (boolean, default false) columns to the POI table.
- **G-4** Add four dedicated curation columns: `verified` (boolean, default
  false, indexed), `verifiedAt` (timestamptz, nullable), `source` (text,
  nullable), `notes` (text, nullable).
- **G-5** Document and apply the slug-prefix convention that resolves the
  46-duplicate-slug problem without changing the `UNIQUE` constraint's shape.
- **G-6** Mark `type` deprecated-transitional: keep the column and its enum
  fully functional (zero behavior change for existing consumers), add
  documentation pointing at HOS-139 as the successor, and do NOT yet touch any
  category-derivation logic (that lives in HOS-139).
- **G-7** Ship the migration with its dual-write counterpart (HOS-25): the
  existing 12 seeded POI fixtures gain `nameI18n`/`descriptionI18n` content in
  the same PR, via both the baseline JSON fixtures and a numbered data
  migration, so a fresh DB and an already-seeded staging/prod DB converge.

## 4. Non-goals

- **NG-1** Importing any of the 914-POI dataset. This spec changes only the
  model and the existing 12-POI fixture set; the bulk import is a separate,
  future issue (`[D]`/`[E]` in the plan) that depends on this one.
- **NG-2** The category M2M model (`poi_categories` / `r_poi_category`) and the
  actual derivation of `type` from a primary category. That is HOS-139 in
  full; this spec only marks `type` as deprecated-transitional so HOS-139 can
  land independently.
- **NG-3** The `relation` (PRIMARY/NEARBY) column on
  `r_destination_point_of_interest`. That is HOS-140 in full.
- **NG-4** Geocoding the 717 coordinate-less dataset rows. Out of scope; a
  future content-enrichment pipeline issue owns that. This spec only makes the
  columns *able* to hold `NULL`.
- **NG-5** Admin CRUD routes/UI for POIs. Still deferred per HOS-113 OQ-6/NG-5;
  unaffected by this spec.
- **NG-6** AI-translating the existing 12 POIs' `es`-only content into `en`/
  `pt`. The data migration seeds `nameI18n`/`descriptionI18n` with the same
  `es` string in all three locale slots (see §7) and marks
  `translationMeta.autoTranslated = false` — a future pass can run the AI
  auto-translate flow already wired into `I18nTextField.tsx` in the admin.

## 5. Current baseline

Verified against the working tree 2026-07-11 (branch off `staging`, HOS-113
merged via PR #2268):

- **Table** `points_of_interest`
  (`packages/db/src/schemas/destination/point-of-interest.dbschema.ts:26-58`):
  `id`, `slug` (`text().notNull().unique()`), `lat`/`long`
  (`doublePrecision().notNull()`, lines 31-32), `type`
  (`PointOfInterestTypePgEnum().notNull()`), `icon` (nullable text),
  `description` (nullable text, plain — **not i18n**), `isBuiltin`,
  `isFeatured`, `displayWeight` (default 50), `lifecycleState`, full
  `BaseModel` audit columns. Indexes: `slug`, `isFeatured`, `lifecycleState`,
  `type` (lines 48-57). **No `nameI18n`/`descriptionI18n`/`translationMeta`,
  no `address`/`keywords`/`hasOwnPage`, no curation columns.**
- **Zod schema** `PointOfInterestSchema`
  (`packages/schemas/src/entities/point-of-interest/point-of-interest.schema.ts:18-91`):
  `slug` (3-100 chars, `^[a-z0-9]+(?:[-_][a-z0-9]+)*$`), `lat`/`long` as
  required `z.number()` with `-90/90`/`-180/180` bounds, `type` via
  `PointOfInterestTypeEnumSchema`, `description` nullish string (10-500
  chars), `icon` nullish, `isFeatured`/`isBuiltin` booleans, `displayWeight`
  int 1-100 default 50. `PointOfInterestSummarySchema`/`MiniSchema` are
  `.pick()` projections of the full schema (lines 97-121) — **no `name` field
  exists anywhere in this set.**
- **The multilang reference pattern (SPEC-212)** already lives in
  `packages/schemas/src/common/i18n.schema.ts`: `I18nTextSchema` (`{es,en,pt}`
  required strings, lines 37-44), the `i18nText({min,max})` factory
  (lines 71-79), and `TranslationMetaSchema` (a `Record<field,
  Record<locale, {autoTranslated, translatedAt, provider?, model?}>>`, lines
  108-119). `destinations` is the model to mirror exactly:
  `destination.dbschema.ts:54-62` keeps the plain `name`/`summary`/
  `description` (`text().notNull()`) columns **alongside** nullable
  `nameI18n`/`summaryI18n`/`descriptionI18n` jsonb columns and a
  `translationMeta` jsonb (default `{}`); `destination.schema.ts:52-77` mirrors
  that in Zod, with the `*I18n` fields as `.nullish()`.
- **Web-side locale collapse**: `apps/web/src/lib/resolve-i18n-text.ts:51-74`
  (`resolveI18nText(value, locale)`) resolves an `I18nText`/partial/plain
  string/null to a display string, falling back `es → en → pt → ''`. This is
  the function any updated POI-consuming component must call.
- **`lat`/`long` are read as guaranteed numbers in THREE places that will break
  silently once they become nullable:**
  1. `resolvePoiToCoordinates`
     (`packages/service-core/src/services/accommodation/accommodation.poi-proximity.helper.ts:115-120`)
     returns `{ found: true, lat: result.data.lat, long: result.data.long,
     radiusKm }` typed as non-nullable `number` — feeds directly into
     `buildWithinRadiusClause`/`buildDistanceOrderByExpr` (`@repo/db`'s
     `geo.ts`), which expect real numeric SQL operands.
  2. `resolvePoiConstraint`
     (`apps/api/src/routes/ai/protected/poi-resolver.ts:193,224-226`)
     destructures `const { lat, long } = poiResult.data;` and returns them
     unconditionally as `number` in the `PoiResolution` `constrain` variant
     (lines 86-88).
  3. `DestinationModel.getPointsOfInterestMap`
     (`packages/db/src/models/destination/destination.model.ts:497-582`)
     types its returned map entries' `lat`/`long` as non-nullable `number`
     (lines 506-507, 546-547) and selects them straight off the table with no
     null-guard.
- **Display-name / type-label consumers keyed by slug/enum (i18n-by-slug,
  HOS-113 OQ-2)**, unaffected functionally by this spec but referenced because
  §6.4 defines their transition path:
  - `apps/web/src/lib/poi-labels.ts:44-72` — `translatePoiName({t, slug})`
    resolves `destinations.poiNames.<slug>`; `translatePoiTypeLabel({t,
    type})` resolves `destinations.poiTypeLabels.<TYPE>`. Both fall back to a
    humanized slug/enum value if the key is missing (R-6 mitigation, never
    crashes).
  - `apps/web/src/components/destination/DestinationPOISection.astro:44-56`
    calls `translatePoiName` to build the display name for every card and
    renders `poi.description` (the plain column) directly at line 76.
  - `apps/api/src/routes/ai/protected/poi-allowlist.ts` /
    `poi-resolver.ts` match/resolve purely by `slug` — unaffected by the
    content-shape change, but sensitive to the slug-prefix convention (§6.5)
    if it is ever applied retroactively (it is NOT, for the existing 12 — see
    §6.5).
- **Seed layer**: `packages/seed/src/required/pointsOfInterest.seed.ts`
  (`normalizePointOfInterestSeedItem`, `createSeedFactory`) + 12 fixtures at
  `packages/seed/src/data/pointOfInterest/001-*.json`..`012-*.json` + the
  `manifest-required.json` `pointsOfInterest` list. A prior data migration,
  `packages/seed/src/data-migrations/0009-hos-113-points-of-interest.ts`, is
  the reference for how a POI-touching data migration is structured; this
  spec's data migration is the next sequential module (`0010-*`).
- **Migration numbering**: current structural migration head in the working
  tree is `packages/db/src/migrations/0051_dapper_nick_fury.sql`; this spec's
  `db:generate` output lands as `0052_*`.
- **Schema Compatibility Policy** (`packages/schemas/CLAUDE.md` → "Schema
  Compatibility Policy (additive-only)"): renaming/removing a shipped field or
  tightening a rule is forbidden without the three-phase additive → backfill →
  removal path. `lat`/`long` required → nullable is a **relaxation** (safe,
  no migration path needed beyond the DB column change itself).

## 6. Proposed design

### 6.1 `name`/`description` → SPEC-212 multilang content

Add `nameI18n` (jsonb, nullable, `$type<I18nText>()`) and `translationMeta`
(jsonb, nullable, default `{}`, `$type<TranslationMeta>()`) as **entirely new**
columns — POI never had a `name` column, so there is no legacy plain-`name`
column to reconcile. Add `descriptionI18n` (jsonb, nullable,
`$type<I18nText>()`) **alongside** the existing plain `description` column
(kept, unchanged, nullable) — mirroring `destinations`' co-existence of a
plain column and its `*I18n` sibling exactly.

**Alternatives considered:**

1. **Keep i18n-by-slug for `name`, only add `descriptionI18n`.** Rejected: the
   whole point of this spec is that POI stops being a closed catalog whose
   labels live in a redeploy-gated i18n file; a 914-row content catalog needs
   admin-editable text, and splitting `name` (i18n-by-slug) from `description`
   (data-multilang) would leave two incompatible authoring models on the same
   entity.
2. **Drop the plain `description` column, `descriptionI18n` becomes the sole
   source.** Rejected: violates the additive-only Schema Compatibility Policy
   (removing a shipped, non-null-capable field) and breaks the 12 existing
   fixtures that already ship real `description` content with no
   `descriptionI18n` yet. Keeping both, with `descriptionI18n` preferred and
   the plain column as the pre-migration fallback, is the same transition
   shape `destinations` already uses in production.
3. **(Chosen) Add `nameI18n`/`descriptionI18n`/`translationMeta`, keep the
   plain `description` column, no plain `name` column ever existed so none is
   added.** Consistent with `destinations`, additive-only, requires zero
   changes to the `PointOfInterestSchema`'s existing required fields.

**Display resolution order** (documented for §6.4's consumer updates, not a
new column): `resolveI18nText(poi.nameI18n, locale)` when `nameI18n` is
non-null, else the legacy `translatePoiName({t, slug})` i18n-by-slug lookup —
this lets the 12 already-migrated POIs (which get real `nameI18n` content in
this spec's data migration, see §7) switch over immediately while any
POI created before a future consumer migration completes doesn't crash.
Same two-tier order for `description`: `resolveI18nText(poi.descriptionI18n,
locale)` else the plain `description` column.

### 6.2 `lat`/`long` → nullable, with a null-safe consumer contract

Change both columns to nullable `doublePrecision`. This is additive per the
Schema Compatibility Policy (required → optional is a relaxation), but it is
NOT consumer-safe by itself — §6.4 lists the three call sites (§5) that MUST
be updated in the same PR:

- `resolvePoiToCoordinates`: when the resolved POI has `lat === null ||
  long === null`, return `{ found: false }` — exactly the same treatment
  already given to a soft-deleted or non-`ACTIVE` POI (lines 111-113 of the
  existing function). A coordinate-less POI is not a valid proximity-search
  center; it is not, however, an error — callers already handle `{ found:
  false }` gracefully (the accommodation service turns it into a 404, the AI
  resolver treats it as "skip this constraint").
- `resolvePoiConstraint`: when `poiResult.data.lat === null || .long ===
  null`, degrade to `{ kind: 'none' }` (constraint skipped) instead of
  destructuring straight into the `constrain` variant — mirrors the existing
  non-fatal-degrade philosophy already used for every other failure path in
  that function (service error, throw, zero destinations).
- `DestinationModel.getPointsOfInterestMap`: widen the returned map entry type
  to `lat: number | null; long: number | null`, and update
  `DestinationPOISection.astro`'s consumers (§6.4) to treat a null-coordinate
  POI as "no map pin, but the list card still renders" (it already does not
  render a pin — this only matters once map pins land, HOS-113 NG-3/OQ-4).

**Alternatives considered:**

1. **Block this migration until the geocoding pipeline delivers 100%
   coverage.** Rejected: makes this spec depend on a not-yet-scoped content
   pipeline for a schema change that is otherwise ready now; every other
   piece of work (categories, destination-relation, admin CRUD) would stall
   behind it for no structural reason.
2. **(Chosen) Make the columns nullable now, fix the three consumers to treat
   `null` as "no coordinate, not an error."** Unblocks the model immediately;
   the geocoding pipeline (future, out of scope) simply backfills `lat`/`long`
   over time with zero further schema change.

### 6.3 New columns: `address`, `keywords`, `hasOwnPage`, curation metadata

- `address` — `text`, nullable. Free-text street address as provided by the
  dataset; no structured geocoding-ready shape in this iteration (that would
  duplicate `BaseLocationFields`' concerns and is out of scope — YAGNI).
- `keywords` — `text[]`, nullable (Postgres native array via Drizzle's
  `text().array()`). Feeds the future AI-search allowlist enrichment
  (mentioned as a plan sub-task under issue `[E]`/`[J]`, out of scope here).
- `hasOwnPage` — `boolean`, `NOT NULL DEFAULT false`. An editable flag (future
  admin-togglable) marking which POIs get a dedicated detail page — the
  mechanism plan issue `[K]` will consume; this spec only adds the column so
  that follow-up is purely additive.
- **Curation columns** — `verified` (`boolean NOT NULL DEFAULT false`,
  indexed — a future correction pipeline needs an efficient `WHERE verified =
  false` scan), `verifiedAt` (`timestamptz`, nullable), `source` (`text`,
  nullable — a free-text provenance label, e.g. `"chatgpt-dataset-2026-07"`),
  `notes` (`text`, nullable — free-text curator notes).

**Alternatives considered (curation metadata only):**

1. **Store curation metadata inside the existing `adminInfo` jsonb**
   (`BaseAdminFields`, already on the table). Rejected: `adminInfo` has no
   index and no typed shape; a bulk correction pipeline filtering
   `WHERE verified = false` across up to 914 rows needs a real indexed
   boolean column, not a jsonb path expression re-derived per query. Also,
   `adminInfo`'s existing shape is not curation-domain-specific — piling
   unrelated concerns into one loosely-typed jsonb blob defeats its purpose.
2. **(Chosen) Four dedicated columns**, `verified` indexed. Directly
   queryable, typed, and matches the plan's explicit rationale (owner
   decision, plan §"Decisiones de diseño").
3. **`verifiedAt` as a plain `date` instead of `timestamptz`.** Rejected for
   consistency: every other `*At` column on this table (and on every other
   `BaseModel`-derived table in the codebase) is `timestamp({withTimezone:
   true})`. Introducing the one `date`-typed timestamp column on this table
   for no functional reason would be a needless special case.

### 6.4 Consumer migration required in this same PR

| File | Required change |
| --- | --- |
| `packages/service-core/.../accommodation.poi-proximity.helper.ts` | Treat `lat === null \|\| long === null` as `{ found: false }` (§6.2). |
| `apps/api/src/routes/ai/protected/poi-resolver.ts` | Treat a null-coordinate primary POI as `{ kind: 'none' }` (§6.2). |
| `packages/db/src/models/destination/destination.model.ts` (`getPointsOfInterestMap`) | Select + type `lat`/`long` as `number \| null`; also select `nameI18n`/`descriptionI18n`/`hasOwnPage` for the destination-detail hydration path so the web section (below) can prefer multilang content once available. |
| `apps/web/src/lib/poi-labels.ts` | `translatePoiName` gains a `nameI18n`-aware overload/parameter: prefer `resolveI18nText(nameI18n, locale)`, fall back to the existing i18n-by-slug lookup when `nameI18n` is null (§6.1). |
| `apps/web/src/components/destination/DestinationPOISection.astro` | Resolve display name/description through the updated `poi-labels.ts` helper and `resolveI18nText(descriptionI18n, locale) ?? poi.description`, instead of calling `translatePoiName`/rendering `poi.description` directly. |

`apps/web/src/lib/poi-type-icons.ts` and the AI allowlist/resolver files that
key purely by `slug`/`type` (unaffected by the content-shape change) are
**not** touched by this spec.

### 6.5 Slug-prefix convention (documented, not a schema change)

No schema change is needed to resolve the 46-duplicate-slug problem: `slug`
stays a single global `UNIQUE text` column exactly as it is today
(`point-of-interest.dbschema.ts:30`). Instead, this spec documents the seed
authoring convention that the future bulk import (`[E]`, out of scope) MUST
follow: **when the dataset's base slug collides across destinations (the 46
documented cases, e.g. `municipalidad`, `terminal-omnibus`), prefix it with
the POI's primary destination's own slug** (`concordia-municipalidad`,
`colon-municipalidad`), keeping the existing `min(3)/max(100)` length bounds
and `^[a-z0-9]+(?:[-_][a-z0-9]+)*$` regex satisfied (a leading destination
slug segment joined by a hyphen is valid under that pattern). The existing 12
POIs are NOT renamed by this spec — none of their slugs collide with each
other or with the 46 documented dataset collisions, so the convention only
applies going forward.

**Alternatives considered:**

1. **Relax `UNIQUE(slug)` to a composite/partial uniqueness scoped to the
   primary destination.** Rejected: POI's relation to destinations is M2M via
   `r_destination_point_of_interest`, not a `destinationId` column on
   `points_of_interest` itself (`point-of-interest.service.ts:482-489`
   explicitly documents this absence) — there is no column to scope a
   composite/partial index against without first picking a "primary
   destination" concept that does not otherwise exist on the POI row. That
   would be new, not-yet-justified schema surface.
2. **(Chosen) Prefix the slug at authoring/import time**, no schema change.
   Simplest (KISS), and the physical-entity framing is correct: a
   `concordia-municipalidad` and a `colon-municipalidad` are two distinct real
   buildings, not one POI shared by two destinations (that sharing case is
   already the M2M join's job).

### 6.6 `type` — deprecated-transitional, unchanged behavior

`type` (the closed 9-value `PointOfInterestTypeEnum`) stays exactly as-is:
`NOT NULL`, its own pgEnum, its own index, resolved via i18n-by-enum-value in
`poi-labels.ts`. This spec adds a `@deprecated` JSDoc annotation on the column
definition (`point-of-interest.dbschema.ts`) and the Zod field
(`point-of-interest.schema.ts`) pointing at HOS-139, and nothing else — no
behavior change, no derivation logic, no consumer update. HOS-139 owns
building the `poi_categories`/`r_poi_category` M2M model and (in its own
scope) deciding how/when `type` gets synced from a POI's primary category;
until that lands, every existing `type`-keyed consumer (search filter,
`poi-labels.ts`'s type badge, the allowlist's inline category comments)
keeps working unmodified.

## 7. Data model / contracts

### 7.1 `points_of_interest` — full column list (v2)

| Column | Type | Change | Notes |
| --- | --- | --- | --- |
| `id` | `uuid PK` | unchanged | |
| `slug` | `text UNIQUE NOT NULL` | unchanged (schema) | Authoring convention changes (§6.5); no constraint change. |
| `lat` | `double precision NULL` | **changed** (was `NOT NULL`) | |
| `long` | `double precision NULL` | **changed** (was `NOT NULL`) | |
| `type` | `point_of_interest_type_enum NOT NULL` | unchanged, `@deprecated` doc only | See §6.6, HOS-139. |
| `icon` | `text NULL` | unchanged | |
| `description` | `text NULL` | unchanged (kept as legacy fallback) | Superseded by `descriptionI18n` where present (§6.1). |
| `nameI18n` | `jsonb NULL` | **new** | `$type<I18nText>()`. |
| `descriptionI18n` | `jsonb NULL` | **new** | `$type<I18nText>()`. |
| `translationMeta` | `jsonb NULL DEFAULT '{}'` | **new** | `$type<TranslationMeta>()`. |
| `address` | `text NULL` | **new** | Free-text. |
| `keywords` | `text[] NULL` | **new** | |
| `hasOwnPage` | `boolean NOT NULL DEFAULT false` | **new** | |
| `verified` | `boolean NOT NULL DEFAULT false` | **new**, indexed | |
| `verifiedAt` | `timestamptz NULL` | **new** | |
| `source` | `text NULL` | **new** | |
| `notes` | `text NULL` | **new** | |
| `isBuiltin` | `boolean NOT NULL DEFAULT false` | unchanged | |
| `isFeatured` | `boolean NOT NULL DEFAULT false` | unchanged | |
| `displayWeight` | `integer NOT NULL DEFAULT 50` | unchanged | |
| `lifecycleState` | enum | unchanged | |
| `adminInfo`, `createdAt/By`, `updatedAt/By`, `deletedAt/By` | `BaseModel` | unchanged | |

New index: `pointsOfInterest_verified_idx` on `verified`.

### 7.2 Migration (Carril 1 — structural)

`pnpm db:generate` → `0052_*.sql`: `ALTER TABLE points_of_interest ALTER
COLUMN lat DROP NOT NULL, ALTER COLUMN long DROP NOT NULL` + `ADD COLUMN`
for every new column in §7.1 + the new `verified` index. No `USING` data
conversion needed (the nullability relaxation requires none; the new columns
all have safe defaults or are nullable).

### 7.3 Zod (`@repo/schemas`)

`PointOfInterestSchema`
(`packages/schemas/src/entities/point-of-interest/point-of-interest.schema.ts`):

- `lat`/`long`: `.nullable()` added to the existing bounded `z.number()`
  (relaxation — safe per Schema Compatibility Policy).
- `nameI18n: I18nTextSchema.nullish()`, `descriptionI18n:
  I18nTextSchema.nullish()`, `translationMeta: TranslationMetaSchema.nullish()`
  — new fields, mirroring `destination.schema.ts:69-77` verbatim.
- `address: z.string().min(3).max(300).nullish()`, `keywords:
  z.array(z.string().min(1).max(50)).max(30).nullish()`, `hasOwnPage:
  z.boolean().default(false)`.
- `verified: z.boolean().default(false)`, `verifiedAt: z.date().nullish()`,
  `source: z.string().max(200).nullish()`, `notes: z.string().max(1000)
  .nullish()`.
- `type`: unchanged shape, gains a `@deprecated` JSDoc comment only.

`PointOfInterestSummarySchema`/`PointOfInterestMiniSchema` (used by relation
listings and dropdowns): extend the `.pick()` projection to include
`nameI18n` (summary needs it for card display; mini needs it for a dropdown
label) and, for the summary only, `descriptionI18n`/`hasOwnPage`.

`PointOfInterestCreateInputSchema`/`UpdateInputSchema`
(`point-of-interest.crud.schema.ts`): no shape change beyond what
`.omit()`/`stripShapeDefaults()` already propagate automatically from the base
schema.

### 7.4 Seed / dual-write (HOS-25)

Same-PR dual write, per the mandatory rule (root `CLAUDE.md` → "Seed
dual-write rule"):

1. **Baseline**: the 12 fixtures at `packages/seed/src/data/pointOfInterest/
   00N-*.json` each gain `nameI18n` (all three locales set to the POI's
   current i18n-string content, sourced from `packages/i18n`'s
   `destinations.poiNames.<slug>` es entry — `en`/`pt` seeded with the same
   `es` string as a placeholder, per NG-6) and `descriptionI18n` (same
   treatment, sourced from the existing plain `description` field already in
   each fixture). `translationMeta` seeded as `{ name: { es: {autoTranslated:
   false, translatedAt: <seed-time ISO>} }, description: { ... } }` (marking
   these as manually-curated, not AI-translated, since they were copied
   verbatim from existing curated content — see NG-6 for the future
   AI-translate follow-up).
2. **Data migration**: `packages/seed/src/data-migrations/0010-hos-138-poi-v2-model-core.ts`
   applies the identical `nameI18n`/`descriptionI18n`/`translationMeta` values
   to the 12 already-seeded rows on any live environment (staging today,
   eventually prod), by `slug` lookup, idempotent (skips a POI whose
   `nameI18n` is already non-null).
3. `scripts/check-seed-dual-write.sh`'s path list already includes the
   `pointOfInterest` glob (added in HOS-113); no further change needed there.

## 8. UX / UI behavior

No new UI surface is introduced by this spec (still no admin CRUD — NG-5). The
only user-visible effect is that the existing destination-detail POI section
(`DestinationPOISection.astro`) keeps rendering identically for the 12
existing POIs (same display name, same description, same layout) — this spec
is required to be **visually a no-op** for the current 12 POIs; any visible
diff on that section is a regression. Verifying this (§9 AC-8) is the
practical smoke test.

## 9. Acceptance criteria

- **AC-1** `points_of_interest` gains every column in §7.1's "new" rows, and
  `lat`/`long` accept `NULL`; migration `0052_*` is committed; `pnpm
  db:generate` drift guard passes with no further diff.
- **AC-2** `PointOfInterestSchema` accepts `lat: null, long: null` and every
  new field per §7.3; `PointOfInterestSummarySchema`/`MiniSchema` expose
  `nameI18n`. Historic fixture `safeParse` compatibility tests
  (`test/fixtures/historic/`) continue to pass unmodified (additive-only
  changes).
- **AC-3** `resolvePoiToCoordinates` returns `{ found: false }` for a POI with
  `lat === null` or `long === null` — a dedicated regression test constructs
  a mock POI service response with null coordinates and asserts this, no
  numeric value ever reaches the geo-SQL helpers.
- **AC-4** `resolvePoiConstraint` returns `{ kind: 'none' }` for a
  null-coordinate primary POI match — a dedicated regression test covers this
  exact case (currently untested since it was previously impossible).
- **AC-5** `DestinationModel.getPointsOfInterestMap` compiles with `lat`/
  `long` typed `number | null` and does not throw when a row has null
  coordinates.
- **AC-6** The 12 existing seeded POIs each carry non-null `nameI18n` and
  `descriptionI18n` after `pnpm db:fresh-dev` (baseline path) AND after
  running `pnpm db:seed:migrate` against a staging-shaped pre-existing DB
  (data-migration path) — both converge to the same content.
  `DestinationPOISection.astro`'s rendered display name/description for all
  12 is unchanged from pre-migration output (AC-8's no-op requirement).
- **AC-7** `pnpm typecheck` and the `@repo/service-core`/`apps/api` test
  suites pass with the updated (nullable-aware) consumer code from §6.4;
  ≥90% coverage on the new null-guard branches.
- **AC-8** No visual/content regression on the destination detail page's POI
  section for any of the 12 existing seeded destinations (manual smoke:
  `pnpm dev` + visit each of the 6 seeded destination detail pages that
  currently render POIs).

## 10. Risks

- **R-1 Silent null-coordinate corruption.** If any of the three call sites in
  §5/§6.2/§6.4 is missed, a `null` lat/long reaches `buildWithinRadiusClause`'s
  numeric SQL path and either throws a DB type error or, worse, silently
  produces a nonsensical distance calculation. Mitigation: AC-3/AC-4 are
  dedicated regression tests, not incidental coverage.
- **R-2 Dual-write drift.** Missing either the baseline fixture edit or the
  data-migration module means fresh DBs and live DBs diverge (the exact
  billing-era bug this rule was written to prevent). Mitigation: AC-6 tests
  both paths explicitly; the CI drift guard (`check-seed-dual-write.sh`)
  already watches this entity.
- **R-3 `translationMeta`'s `autoTranslated: false` backfill is misleading.**
  Marking copied-verbatim `en`/`pt` placeholders as "not auto-translated" is
  technically imprecise (they are placeholders, not real translations of
  either kind). Mitigation: documented explicitly in §7.4/NG-6 as a known,
  deliberate placeholder state pending a future AI-translate pass; do not
  treat these 12 rows' `en`/`pt` content as production-quality translations.
- **R-4 `type`'s deprecation is annotation-only.** Because HOS-138 makes zero
  functional change to `type`, there is a real risk that a future PR reads
  the `@deprecated` JSDoc, assumes derivation logic already exists, and skips
  wiring it when HOS-139 actually lands. Mitigation: HOS-139's own spec must
  explicitly own the derivation-sync task (cross-referenced in both specs).
- **R-5 Slug-prefix convention is documentation-only until the import lands.**
  Nothing in this spec enforces the convention at the schema or service
  layer — a future importer could still create a colliding un-prefixed slug
  and simply fail the `UNIQUE` constraint at insert time (a loud failure, not
  silent, but only caught then). Mitigation: accepted for this spec's scope;
  the future import issue (`[E]`, out of scope) is the one that must actually
  apply the convention and should validate zero-collision as a precondition
  before bulk inserting.

## 11. Open questions

- **OQ-1 (resolved for this spec's scope)** — Should `descriptionI18n`
  eventually fully replace the plain `description` column (three-phase
  removal per the Schema Compatibility Policy)? **Deferred**: not decided
  here; revisit once the 914-row import (out of scope) proves the plain
  column is genuinely unused going forward. Keeping both indefinitely is the
  safe default.
- **OQ-2** Should `keywords` have any structural validation (e.g. lowercase
  normalization, de-dup) at the Zod layer, or is that purely an import-time
  concern? Leaning toward import-time only (this spec just needs the column
  to exist and accept an array) — confirm when the import spec is written.
- **OQ-3** Does `hasOwnPage` need a partial index (`WHERE has_own_page =
  true`) now, given it will be queried by the future POI-detail-page feature
  (`[K]` in the plan) to build a sitemap/static-path list? Deferred to that
  feature's own spec; this spec adds the plain column only.

## 12. Implementation notes

Suggested phasing (for Task Master task generation):

1. **DB schema**: `point-of-interest.dbschema.ts` column changes + migration
   `0052_*` + new `verified` index.
2. **Zod schema**: `point-of-interest.schema.ts` + `.crud.schema.ts` +
   summary/mini projections, per §7.3.
3. **Consumer null-safety fixes**: the three §6.4/§5 call sites
   (`accommodation.poi-proximity.helper.ts`, `poi-resolver.ts`,
   `destination.model.ts`), each with its own regression test (AC-3/AC-4).
4. **Web display-path update**: `poi-labels.ts` + `DestinationPOISection.astro`
   per §6.1's resolution order, verified against AC-8's no-op requirement.
5. **Seed dual-write**: fixture edits + `0010-hos-138-poi-v2-model-core.ts`
   data migration + verification against both a fresh DB and a
   pre-HOS-138-shaped seeded DB.
6. **Quality gate**: `pnpm typecheck`, full `@repo/db`/`@repo/schemas`/
   `@repo/service-core`/`apps/api`/`apps/web` relevant test suites,
   `check-seed-dual-write.sh`, manual smoke per AC-8.

Do not start HOS-139 or HOS-140 implementation until this spec's migration and
consumer fixes are merged — both depend on this table shape being final.

## 13. Linear

Canonical tracking:
HOS-138

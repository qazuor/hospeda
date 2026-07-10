---
title: Points of Interest (POI) in destinations
linear: HOS-113
statusSource: linear
created: 2026-07-10
type: feature
areas:
  - db
  - api
  - web
---

# Points of Interest (POI) in destinations

> **Open-question resolutions (owner, 2026-07-10)** — see §11 for detail.
> OQ-1 → **M2M** (join table, not 1:N). OQ-2 → **i18n by slug** (no `name`
> column, SPEC-266 pattern). OQ-3 → **closed `type` enum**. OQ-6 → **seed-only**
> in Phase 1 (admin CRUD deferred). OQ-4/5/7 remain open, deferred to their phase.

## 1. Summary

Introduce a first-class **Point of Interest (POI)** concept: a coordinate-bearing
landmark (`lat`/`long`) associated with **one or more destinations** (many-to-many).
POIs power three capabilities that are impossible today because the codebase has
no landmark-with-coordinates entity:

1. **Accommodation search by proximity** — "alojamientos cerca del autódromo de
   Concepción del Uruguay" / "cerca de la playa Banco Pelay".
2. **Destination detail enrichment** — show a destination's POIs on its public
   page (web).
3. **AI search natural-language resolution** — the chat resolves a POI mentioned
   in free text (allowlist injected into the prompt, same pattern already used
   for amenities/features/attractions).

POI is a **new, distinct entity** — NOT an extension of the `attractions`
catalog. Structurally it mirrors `attractions` closely (M2M to destinations,
slug-keyed i18n display, curated seed) but adds the one thing attractions lack:
geographic coordinates. Display names come from `@repo/i18n` keyed by slug
(SPEC-266), so POI carries **no `name` column**.

## 2. Problem

- The AI search work (HOS-111) surfaced that users want to search by landmark
  proximity, but there is **no entity in the codebase carrying a landmark's
  lat/long**. Only `accommodations.location.coordinates` and
  `destinations.location.coordinates` have coordinates today, and a destination's
  single centroid is too coarse to answer "near the racetrack" or "near a
  specific beach".
- `attractions` looks superficially similar but is the wrong tool: it has no
  coordinates (`packages/db/src/schemas/destination/attraction.dbschema.ts`) and
  overloading it would corrupt a clean, shared concept. HOS-113 adds a parallel
  entity, not a mutation of attractions.

## 3. Goals

- **G-1** New `points_of_interest` table + `r_destination_point_of_interest`
  join table + Drizzle schema + Zod schema (6-file set) + service + seed,
  following the established attraction/entity conventions.
- **G-2** Accommodation search can rank/filter by proximity to a resolved POI,
  reusing the **already-shipped** shared Haversine helper
  (`packages/db/src/utils/geo.ts`) — no geo extraction work is in scope.
- **G-3** A destination's POIs are exposed via the API and displayed on the
  public destination detail page (web).
- **G-4** AI search resolves a POI named in natural language via an injected
  allowlist, mirroring the amenity/feature/attraction pattern, and feeds the
  resolved POI's coordinates into the proximity search.

## 4. Non-goals

- **NG-1** Extending or migrating the `attractions` catalog. Untouched.
- **NG-2** Re-implementing or re-extracting any Haversine/distance helper. It
  already exists and ships in `@repo/db` (`utils/geo.ts`, PR #2212). We consume
  it.
- **NG-3** Multi-marker map rendering of POIs on the destination page in the
  first iteration (see R-2 / OQ-4 — `LocationMap` has no multi-marker mode; this
  is deferred unless explicitly pulled in).
- **NG-4** User-generated / owner-submitted POIs. POIs are an editorial catalog,
  populated by seed.
- **NG-5** Admin CRUD UI for POIs in Phase 1 (OQ-6). POIs are seed-only for now;
  an admin management surface is a deferred follow-up.

## 5. Current baseline

Verified against the codebase 2026-07-10 (see HOS-113 research notes):

- **Shared Haversine helper ALREADY EXISTS — HOS-113 is UNBLOCKED.**
  `packages/db/src/utils/geo.ts` (HOS-111 PR #2212) exports reusable, non-private
  helpers: `buildHaversineDistanceExpr({ latCol, longCol, lat, long })`,
  `buildWithinRadiusClause({ ..., radiusKm })`,
  `buildDistanceOrderByExpr({ ..., order })`, plus JSONB-extraction helpers
  (`buildJsonbCoordinateExprs`, `buildCoordinatesNotNullClause`) and
  `EARTH_RADIUS_KM`. It is already consumed by `accommodation.model.ts` and
  `destination.model.ts` (`findNearby`). Its JSDoc explicitly names itself as
  HOS-113's foundation and notes it accepts either a JSONB-extracted expression
  or a plain numeric `AnyColumn`. **The HOS-111 spec.md still describes this in
  future tense — that text is stale; the code shipped.**
- **`attractions`** (`packages/db/src/schemas/destination/attraction.dbschema.ts`):
  `id`, `slug` (unique), `description?`, `icon?`, `isBuiltin`, `isFeatured`,
  `displayWeight`, `lifecycleState`, full BaseModel audit columns. **No `name`
  column** (dropped — display via i18n by slug, SPEC-266) and **no coordinates**.
  M2M via `r_destination_attraction.dbschema.ts` (composite PK, cascade both
  sides, indexed both directions). Zod 6-file set at
  `packages/schemas/src/entities/attraction/`. Service at
  `packages/service-core/src/services/attraction/`. Seeded as a `--required`
  group (`packages/seed/src/required/attractions.seed.ts` + `src/data/attraction/*.json`
  + `manifest-required.json`), with a separate relationship-seed step for the
  join table. This is the structural template to mirror almost 1:1.
- **Destination hydration of attractions**: `DestinationService` does NOT eager-load
  attractions on the base read; `getBySlug`/`getByPath` call a private
  `_withAttractions()` that batch-loads via `DestinationModel.getAttractionsMap`
  (junction-table batch query). POI hydration mirrors this exactly.
- **Coordinate shapes**: `CoordinatesSchema`
  (`packages/schemas/src/common/location.schema.ts`) stores `{ lat, long }` as
  **strings** (key is `long`, not `lng`), requiring a `::numeric` cast in SQL.
  `accommodations.location`/`destinations.location` are JSONB with optional
  `coordinates`. A privacy-obfuscated `ApproximateLocationSchema` uses
  `{ lat, lng, radiusMeters }` (numbers, `lng`) — a different concept, do not
  conflate. POI is net-new and uses plain numeric columns instead (§6.1).
- **AI search allowlist pattern** (three files):
  `apps/api/src/routes/ai/protected/{amenity,attraction}-allowlist.ts` define
  `Record<locale, Record<NLTerm, slug|slug[]>>` + a pure `match*Terms()` matcher;
  `search-chat.prompt.ts` (`buildAllowlistLines`) flattens each into a prompt
  instruction line; attractions add an extra `attraction-resolver.ts` that maps
  matched slugs → destination IDs and intersects with existing location
  constraints.
- **Destination detail page (web)**:
  `apps/web/src/pages/[lang]/destinos/[...path].astro` reads `dest.attractions`
  (hydrated server-side by `DestinationService._withAttractions()`); attractions
  render as header badges (`DestinationDetailHeader.astro`).
  `DestinationAttractionsGrid.astro` exists but is **dead code** (not imported).
  `DestinationMiniMap.astro` → `LocationMap.client.tsx` supports a **single**
  marker/circle only — no multi-marker mode.
- **Migrations**: three-carril setup (structural `db:generate`, extras,
  seed data-migrations). Current migration head `0049_*`; new tables land as
  `0050_*`. Net-new-table example to mirror: `0048_glossy_psylocke.sql`
  (`social_post_target_media`).

## 6. Proposed design

### 6.1 Data model — `points_of_interest` + join table (M2M)

**Relation: many-to-many** (OQ-1, owner decision). A POI belongs to one OR MORE
destinations via a join table, exactly like attractions. The POI's coordinates
live on the POI row (a single physical point); the join table is a pure
destination↔POI mapping, letting a regional/border landmark surface from several
destinations.

Table `points_of_interest` (mirroring BaseModel + attraction conventions):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `slug` | text UNIQUE | **the i18n key** (SPEC-266); regex allows underscores. Provided by seed. |
| `lat` | double precision | **plain numeric column** — no string/JSONB baggage |
| `long` | double precision | key named `long` for codebase consistency with `geo.ts` |
| `type` | varchar (enum-backed) | closed `PointOfInterestTypeEnum` (OQ-3): `beach`, `stadium`, `park`, `museum`, `plaza`, `monument`, `viewpoint`, `natural`, `other` |
| `icon` | text? | nullable; may be derived from `type` at render time |
| `description` | text? | nullable, optional (not i18n in Phase 1) |
| `isBuiltin` | boolean | mirrors attraction |
| `isFeatured` | boolean | default false — surface ordering |
| `displayWeight` | int | default 50 — ordering within a destination |
| `lifecycleState` | enum | standard |
| BaseModel audit | | `adminInfo`, `createdAt/By`, `updatedAt/By`, `deletedAt/By` |

**No `name` column** (OQ-2). Display name resolves via `@repo/i18n` keyed by
slug (`destinations.poiNames.<slug>`, es/en/pt), same as amenities/features
after SPEC-266. `type` labels likewise resolve by enum value via i18n.

Join table `r_destination_point_of_interest` (mirror `r_destination_attraction`):
`destinationId` + `pointOfInterestId` composite PK, `ON DELETE CASCADE` both
sides, indexed both directions.

**Coordinate decision**: store `lat`/`long` as plain `double precision` numeric
columns, NOT the string-in-JSONB shape that `accommodations`/`destinations` use.
`buildHaversineDistanceExpr` accepts a plain numeric `AnyColumn` directly, so we
skip `buildJsonbCoordinateExprs` and the `::numeric` cast entirely.

### 6.2 Accommodation proximity search

- POI resolution produces `{ lat, long }` (+ the set of destinationIds it maps
  to). The **existing** accommodation search already accepts
  `latitude`/`longitude`/`radius` query params and applies
  `buildWithinRadiusClause` / `buildDistanceOrderByExpr`
  (`accommodation.model.ts`). Feeding a POI's coordinates as the search center
  reuses that path **with zero new geo SQL**.
- Add a way to search "near POI X": accept a `poiId`/`poiSlug` param on the
  accommodation search that the API expands into lat/long/radius server-side
  (preferred — keeps the coordinate contract server-side). Default radius TBD
  (OQ-5).

### 6.3 AI search POI resolution

Mirror the attraction three-file pattern:

1. `apps/api/src/routes/ai/protected/poi-allowlist.ts` — curated
   `Record<locale, Record<NLTerm, slug|slug[]>>` (POIs are named entities, so the
   NL terms are landmark names/aliases) + a pure `matchPoiTerms(text, locale)`
   matcher (substring, case-insensitive, dedup, never invents a slug).
2. Wire it into `search-chat.prompt.ts` `buildAllowlistLines(locale)` as an
   additional instruction line.
3. `poi-resolver.ts` — matched slug → POI row → `{ lat, long }` + mapped
   destinationIds, intersected with any existing location constraint (same
   intersect-or-no-match rule as attractions).
4. Add a `poiSlugs` slot to `SearchIntentEntitiesSchema` mirroring
   `attractionSlugs`.

Every allowlist slug MUST be cross-checked against real seed JSON (documented
HOS-111 lesson T-009 — silent slug mismatch).

### 6.4 Destination detail (web)

- API: extend the destination detail hydration to include the destination's POIs
  — a `_withPointsOfInterest()` batch load parallel to `_withAttractions()`,
  backed by a `DestinationModel.getPointsOfInterestMap` junction-table batch
  query mirroring `getAttractionsMap`.
- Web: render a POI section on `[...path].astro`. First iteration is a **list /
  grid** (new `DestinationPOISection.astro`, shape: i18n label + `type`/`icon` +
  optional `description`), NOT map pins (multi-marker deferred — NG-3 / OQ-4).
  Build fresh rather than resurrect the dead `DestinationAttractionsGrid.astro`.

### 6.5 Admin (deferred)

Admin CRUD for POIs is **out of scope for Phase 1** (OQ-6). The catalog is
populated by seed only. A future follow-up may add an admin management surface;
the service is built read-capable + seed-writable so that follow-up is additive.

## 7. Data model / contracts

- **DB migration**: carril 1, `pnpm db:generate` → `0050_*` (mirror
  `0048_glossy_psylocke.sql`): `CREATE TABLE points_of_interest` (unique index on
  `slug`) + `CREATE TABLE r_destination_point_of_interest` (composite PK, 2 FKs
  cascade, index both directions).
- **Zod (`@repo/schemas`)**: `packages/schemas/src/entities/point-of-interest/`
  with the standard 6-file set (`.schema`, `.crud`, `.query`, `.http`, `.access`,
  `.relations`) mirroring `attraction/`. `slug` (i18n key), `lat`/`long` as
  numbers with latitude/longitude range validation, `type` via
  `PointOfInterestTypeEnum`. **No `name` field.** Add `PointOfInterestTypeEnum`
  to the enums package alongside the other domain enums.
- **Service (`@repo/service-core`)**: `PointOfInterestService extends
  BaseCrudService`, with `.helpers/.normalizers/.permissions` siblings.
  Permission checks via `PermissionEnum`. Read + proximity + seed-write; no admin
  write routes in Phase 1.
- **API routes**: public read only in Phase 1 — list a destination's POIs,
  resolve by slug (for proximity). No `/admin/points-of-interest` CRUD yet
  (NG-5).
- **Seed**: `packages/seed/src/data/pointOfInterest/*.json` (one file per POI) +
  `packages/seed/src/required/pointsOfInterest.seed.ts` (`createSeedFactory`) +
  `manifest-required.json` entry + a **join-table relationship seed step**
  (mirror the attraction↔destination relationship seed). Update
  `scripts/check-seed-dual-write.sh` path list to include the new
  `pointOfInterest` glob.
- **i18n (`@repo/i18n`)**: add `destinations.poiNames.<slug>` display strings
  (es/en/pt) for every seeded POI, plus `type` label strings for each enum value.
  Slugs in the seed JSON must exactly match the i18n keys (SPEC-266 discipline).

## 8. UX / UI behavior

- **Destination detail**: a POI section listing the destination's POIs (i18n
  display name + `type`/`icon` + optional `description`), ordered by
  `displayWeight` then name, featured first. Guarded like attractions (empty →
  section hidden).
- **Search**: when a POI is resolved (via AI chat or an explicit "near POI"
  entry point), results are filtered/ranked by distance to the POI coordinates.
- **Map**: single-marker map behavior unchanged in iteration 1. Multi-marker POI
  pins are a follow-up (OQ-4).

## 9. Acceptance criteria

- **AC-1** A `points_of_interest` table + `r_destination_point_of_interest`
  join table exist, with numeric `lat`/`long`, unique `slug` (no `name` column),
  `type` enum, and BaseModel audit columns; migration `0050_*` committed;
  `pnpm db:generate` drift guard passes.
- **AC-2** `@repo/schemas` exposes the POI 6-file set + `PointOfInterestTypeEnum`;
  `@repo/service-core` exposes `PointOfInterestService` (read/proximity,
  permission-gated); ≥90% coverage on new pure logic.
- **AC-3** POIs are seeded as a `--required` group with their destination
  relationships and appear on a fresh `db:fresh-dev` DB;
  `check-seed-dual-write.sh` recognizes the new fixture path.
- **AC-4** Accommodation search returns accommodations ranked/filtered by
  proximity to a given POI (`poiId`/`poiSlug` param), consuming `geo.ts` helpers
  (no new distance SQL).
- **AC-5** The public destination detail page renders the destination's POIs with
  i18n display names.
- **AC-6** The AI search chat resolves a POI named in natural language (allowlist
  hit) and applies its coordinates to the proximity search; unmatched terms are
  ignored (no hallucinated slugs).
- **AC-7** POI display names and `type` labels resolve via `@repo/i18n` by slug /
  enum value in es/en/pt; there is no `name` column and no untranslated fallback
  string baked into the table.

## 10. Risks

- **R-1 Stale dependency framing.** The issue and HOS-111 spec.md describe the
  Haversine helper as "to be extracted", but it already shipped. Mitigation:
  baseline (§5) documents the real state; NG-2 forbids re-extraction. Do not
  waste a task on it.
- **R-2 Map multi-marker is not a drop-in.** Rendering N POI pins requires
  extending `LocationMapInner.client.tsx` (Leaflet) with a markers-array mode.
  Mitigation: deferred to a follow-up (NG-3); iteration 1 is list-only.
- **R-3 Coordinate-shape trap.** Copying `accommodations`' string/JSONB `long`
  shape carelessly would reintroduce `::numeric` casts and the `long`/`lng`
  naming confusion. Mitigation: POI uses plain numeric columns (§6.1).
- **R-4 AI hallucinated POIs.** The LLM could invent a landmark. Mitigation: the
  allowlist matcher only emits slugs present in the curated dict, cross-checked
  against seed JSON (same defense as attractions).
- **R-5 Seed dual-write guard.** Once POI seed is live, later fixture edits need
  a data-migration; the guard's path list must include POI or a future edit
  silently skips staging/prod. Mitigation: update the guard in the seed PR.
- **R-6 i18n/slug drift.** With no `name` column, a POI whose slug lacks an
  i18n entry renders as a raw slug (or missing-key). Mitigation: every seeded
  slug ships its `destinations.poiNames.<slug>` string in the same PR; add a
  test asserting each seeded POI slug has i18n coverage in all three locales.

## 11. Open questions

**Resolved (owner, 2026-07-10):**

- **OQ-1 (relation cardinality) — RESOLVED: M2M.** Owner chose a join table
  (`r_destination_point_of_interest`) over the recommended 1:N. A POI may belong
  to several destinations; coordinates live on the POI row.
- **OQ-2 (name i18n) — RESOLVED: i18n by slug.** No `name` column; display via
  `@repo/i18n` keyed by slug (SPEC-266 pattern), es/en/pt.
- **OQ-3 (`type` taxonomy) — RESOLVED: closed enum.** `PointOfInterestTypeEnum`
  = `beach | stadium | park | museum | plaza | monument | viewpoint | natural |
  other`.
- **OQ-6 (authoring) — RESOLVED: seed-only in Phase 1.** No admin CRUD UI now
  (NG-5); deferred follow-up.

**Still open (deferred to their phase):**

- **OQ-4 (destination map pins)** — Iteration 1 is list-only (recommended);
  multi-marker map pins deferred. Revisit when/if pins are pulled in.
- **OQ-5 (proximity search entry + default radius)** — `poiId`/`poiSlug` param on
  accommodation search expanded server-side to lat/long/radius (recommended
  approach). Open: the default radius (e.g. 5km?) when none is given — decide in
  Phase 2.
- **OQ-7 (allowlist population)** — Curate the AI allowlist statically from the
  seed set (recommended, mirrors attractions); new seeded POIs need a matching
  allowlist entry to be AI-resolvable. Confirm in Phase 3.

## 12. Implementation notes

- Suggested phasing (for Task Master task generation):
  - **Phase 1 — Data layer**: `points_of_interest` + join table + migration,
    `PointOfInterestTypeEnum`, Zod 6-file set, service + permissions, seed
    fixtures + relationship seed + manifest + i18n strings + dual-write guard
    update. **No admin CRUD** (NG-5).
  - **Phase 2 — Proximity search (API)**: POI resolution + accommodation search
    "near POI" (`poiId`/`poiSlug`), consuming `geo.ts`; decide default radius
    (OQ-5).
  - **Phase 3 — AI search**: `poi-allowlist.ts` + `poi-resolver.ts` +
    `buildAllowlistLines` wiring + `poiSlugs` intent slot (OQ-7).
  - **Phase 4 — Destination detail (web)**: `_withPointsOfInterest()` hydration +
    `DestinationPOISection.astro`.
  - **(Deferred) Phase 5**: multi-marker map pins (extend `LocationMap`); admin
    CRUD surface.
- **POI mirrors `attraction` almost 1:1** — same M2M join-table shape, slug-keyed
  i18n display (no `name`), `isBuiltin`/`isFeatured`/`displayWeight`, curated
  `--required` seed with a relationship step. The ONLY structural additions are:
  `lat`/`long` numeric columns and the `type` enum. Copy the attraction layer by
  layer (schema → model → service → seed → i18n) and layer these two on top.
- Reuse `@repo/db` `utils/geo.ts` directly. Pass POI's numeric `lat`/`long`
  columns to `buildHaversineDistanceExpr` — no JSONB extraction, no `::numeric`.
- Cross-check every AI allowlist slug against the seed JSON before shipping
  (HOS-111 T-009 lesson).

## 13. Linear

Canonical tracking:
HOS-113

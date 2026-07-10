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

## 1. Summary

Introduce a first-class **Point of Interest (POI)** concept: a named landmark
with geographic coordinates (`lat`/`long`), scoped to a single destination.
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
catalog. Attractions are a curated, icon/description catalog with NO coordinates
and a many-to-many relation to destinations; POIs are coordinate-bearing named
places belonging to exactly one destination.

## 2. Problem

- The AI search work (HOS-111) surfaced that users want to search by landmark
  proximity, but there is **no entity in the codebase carrying a landmark's
  lat/long**. Only `accommodations.location.coordinates` and
  `destinations.location.coordinates` have coordinates today, and a destination's
  single centroid is too coarse to answer "near the racetrack" or "near a
  specific beach".
- `attractions` looks superficially similar but is the wrong tool: it has no
  coordinates (`packages/db/src/schemas/destination/attraction.dbschema.ts`),
  is a curated M2M catalog, and overloading it would corrupt a clean, shared
  concept. HOS-113 must add a parallel entity, not mutate attractions.

## 3. Goals

- **G-1** New `points_of_interest` table + Drizzle schema + Zod schema (6-file
  set) + service + seed, following the established attraction/entity conventions.
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
- **NG-4** User-generated / owner-submitted POIs. POIs are an editorial catalog
  (seed + admin CRUD), not user content.
- **NG-5** Full i18n translation of POI names. POIs are proper nouns of real
  places (see OQ-2).

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
  `id`, `name`, `slug` (unique), `description?`, `icon?`, `isBuiltin`,
  `isFeatured`, `displayWeight`, `lifecycleState`, full BaseModel audit columns.
  **No coordinates.** M2M via `r_destination_attraction.dbschema.ts`. Zod 6-file
  set at `packages/schemas/src/entities/attraction/`. Service at
  `packages/service-core/src/services/attraction/`. Seeded as a `--required`
  group (`packages/seed/src/required/attractions.seed.ts` + `src/data/attraction/*.json`
  + `manifest-required.json`). This is the structural template to mirror.
- **Coordinate shapes**: `CoordinatesSchema`
  (`packages/schemas/src/common/location.schema.ts`) stores `{ lat, long }` as
  **strings** (key is `long`, not `lng`), requiring a `::numeric` cast in SQL.
  `accommodations.location`/`destinations.location` are JSONB with optional
  `coordinates`. A privacy-obfuscated `ApproximateLocationSchema` uses
  `{ lat, lng, radiusMeters }` (numbers, `lng`) — a different concept, do not
  conflate.
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
  seed data-migrations). Current migration head `0049_*`; a new table lands as
  `0050_*`. Net-new-table example to mirror: `0048_glossy_psylocke.sql`
  (`social_post_target_media`).

## 6. Proposed design

### 6.1 Data model — `points_of_interest`

A **1:N** relation (a POI belongs to exactly one destination via a direct FK),
NOT the M2M join-table pattern attractions use. This matches the "scoped to a
destination" wording and is structurally simpler (see OQ-1).

Columns (mirroring BaseModel conventions):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `destinationId` | uuid FK → `destinations` | `ON DELETE CASCADE`, indexed |
| `name` | text | 3-100 chars, proper name (e.g. "Autódromo de Concepción del Uruguay") |
| `slug` | text UNIQUE | auto-derived by service hook; regex allows underscores (SPEC-266 convention) |
| `lat` | double precision | **plain numeric column** — no string/JSONB baggage |
| `long` | double precision | key named `long` for codebase consistency with `geo.ts` |
| `type` | varchar (enum-backed) | POI category for icon/filter (beach, stadium, park, museum, …) — see OQ-3 |
| `icon` | text? | nullable; may be derived from `type` |
| `description` | text? | nullable, optional |
| `isFeatured` | boolean | default false — surface ordering |
| `displayWeight` | int | default 50 — ordering within a destination |
| `lifecycleState` | enum | standard |
| BaseModel audit | | `adminInfo`, `createdAt/By`, `updatedAt/By`, `deletedAt/By` |

**Coordinate decision**: store `lat`/`long` as plain `double precision` numeric
columns, NOT the string-in-JSONB shape that `accommodations`/`destinations` use.
Since POI is a net-new table there is no legacy constraint, and
`buildHaversineDistanceExpr` accepts a plain numeric `AnyColumn` directly — so we
skip `buildJsonbCoordinateExprs` and the `::numeric` cast entirely.

### 6.2 Accommodation proximity search

- POI resolution produces a `{ lat, long, destinationId }`. The **existing**
  accommodation search already accepts `latitude`/`longitude`/`radius` query
  params and applies `buildWithinRadiusClause` / `buildDistanceOrderByExpr`
  (`accommodation.model.ts`). Feeding a POI's coordinates as the search center
  reuses that path **with zero new geo SQL**.
- Add a way to search "near POI X": either a public endpoint that resolves a POI
  slug/id → coordinates, or accept a `poiId`/`poiSlug` param on the accommodation
  search that the API expands into lat/long/radius server-side (preferred — keeps
  the coordinate contract server-side). Default radius TBD (OQ-5).

### 6.3 AI search POI resolution

Mirror the attraction three-file pattern:

1. `apps/api/src/routes/ai/protected/poi-allowlist.ts` — curated
   `Record<locale, Record<NLTerm, slug|slug[]>>` (POIs are named entities, so the
   NL terms are landmark names/aliases) + a pure `matchPoiTerms(text, locale)`
   matcher (substring, case-insensitive, dedup, never invents a slug).
2. Wire it into `search-chat.prompt.ts` `buildAllowlistLines(locale)` as an
   additional instruction line.
3. `poi-resolver.ts` — matched slug → POI row → `{ lat, long, destinationId }`,
   intersected with any existing location constraint (same intersect-or-no-match
   rule as attractions).
4. Add a `poiSlugs` slot to `SearchIntentEntitiesSchema` mirroring
   `attractionSlugs`.

Every allowlist slug MUST be cross-checked against real seed JSON (documented
HOS-111 lesson T-009 — silent slug mismatch).

### 6.4 Destination detail (web)

- API: extend the destination detail hydration to include the destination's POIs
  (parallel to `_withAttractions()` — a `_withPointsOfInterest()` batch load, or
  a dedicated `GET /destinations/:id/points-of-interest`).
- Web: render a POI section on `[...path].astro`. First iteration is a **list /
  grid** (new `DestinationPOISection.astro`, shape `name`/`type`/`icon`/`description`),
  NOT map pins (multi-marker deferred — NG-3 / OQ-4). Decide explicitly whether
  to build fresh or resurrect the dead `DestinationAttractionsGrid.astro`.

### 6.5 Admin

Minimal admin CRUD for POIs (create/edit/delete, set coordinates, assign to a
destination), following existing admin entity patterns. Needed so the catalog is
maintainable beyond the initial seed (OQ-6 confirms scope).

## 7. Data model / contracts

- **DB migration**: carril 1, `pnpm db:generate` → `0050_*` (mirror
  `0048_glossy_psylocke.sql`): `CREATE TABLE points_of_interest`, FK to
  `destinations` (cascade), unique index on `slug`, index on `destinationId`.
- **Zod (`@repo/schemas`)**: `packages/schemas/src/entities/point-of-interest/`
  with the standard 6-file set (`.schema`, `.crud`, `.query`, `.http`, `.access`,
  `.relations`) mirroring `attraction/`. `lat`/`long` as numbers with
  latitude/longitude range validation.
- **Service (`@repo/service-core`)**: `PointOfInterestService extends
  BaseCrudService`, with `.helpers/.normalizers/.permissions` siblings. Slug
  auto-derivation hook like attraction. Permission checks via `PermissionEnum`.
- **API routes**: public read (list by destination, resolve by slug), admin CRUD
  under `/api/v1/admin/points-of-interest`, per the three-tier architecture.
- **Seed**: `packages/seed/src/data/pointOfInterest/*.json` (one file per POI) +
  `packages/seed/src/required/pointsOfInterest.seed.ts` (`createSeedFactory`) +
  `manifest-required.json` entry. Direct `destinationId` FK → no join-table seed
  step. Update `scripts/check-seed-dual-write.sh` path list to include the new
  `pointOfInterest` glob.
- **i18n**: if `type` is an enum, category labels come from `@repo/i18n` by slug
  (SPEC-266 convention). POI `name` stays literal (OQ-2).

## 8. UX / UI behavior

- **Destination detail**: a POI section listing the destination's POIs
  (name + type/icon + optional description), ordered by `displayWeight` then name,
  featured first. Guarded like attractions (empty → section hidden).
- **Search**: when a POI is resolved (via AI chat or an explicit "near POI"
  entry point), results are filtered/ranked by distance to the POI coordinates.
- **Map**: single-marker map behavior unchanged in iteration 1. Multi-marker POI
  pins are a follow-up (OQ-4).

## 9. Acceptance criteria

- **AC-1** A `points_of_interest` table exists with a 1:N FK to `destinations`,
  numeric `lat`/`long`, unique `slug`, and BaseModel audit columns; migration
  `0050_*` committed; `pnpm db:generate` drift guard passes.
- **AC-2** `@repo/schemas` exposes the POI 6-file set; `@repo/service-core`
  exposes `PointOfInterestService` with permission-gated CRUD; ≥90% coverage on
  new pure logic.
- **AC-3** POIs are seeded as a `--required` group and appear on a fresh
  `db:fresh-dev` DB; `check-seed-dual-write.sh` recognizes the new fixture path.
- **AC-4** Accommodation search returns accommodations ranked/filtered by
  proximity to a given POI, consuming `geo.ts` helpers (no new distance SQL).
- **AC-5** The public destination detail page renders the destination's POIs.
- **AC-6** The AI search chat resolves a POI named in natural language (allowlist
  hit) and applies its coordinates to the proximity search; unmatched terms are
  ignored (no hallucinated slugs).
- **AC-7** Admin can create/edit/delete a POI and assign it to a destination.

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

## 11. Open questions

- **OQ-1 (relation cardinality)** — Confirm **1:N** (direct `destinationId` FK)
  vs M2M (attraction-style join table). Recommendation: **1:N** — a POI is a
  physical place in one destination; M2M adds complexity with no clear use case.
- **OQ-2 (name i18n)** — POI `name` as a literal proper noun (recommended, no
  translation) vs i18n-by-slug like amenities/features. Real landmark names
  generally aren't translated; only `description` might warrant i18n later.
- **OQ-3 (`type` taxonomy)** — Closed enum (beach/stadium/park/museum/plaza/…)
  for icon + filtering (recommended) vs free-text `type` vs no `type` at all.
  A small enum enables consistent icons and future category filters.
- **OQ-4 (destination map pins)** — Ship iteration 1 as a list only
  (recommended) and defer multi-marker map pins to a follow-up, or invest in
  extending `LocationMap` now.
- **OQ-5 (proximity search entry + default radius)** — Expose "near POI" via a
  `poiId`/`poiSlug` param on accommodation search that the server expands to
  lat/long/radius (recommended), and what default radius (e.g. 5km?) applies when
  none is given.
- **OQ-6 (authoring)** — Confirm POIs are seed + admin-CRUD editorial catalog
  (recommended). No owner/user-submitted POIs in scope (NG-4).
- **OQ-7 (allowlist population)** — Curate the AI allowlist statically from the
  seed set (recommended, mirrors attractions) — accept that new seeded POIs need
  a matching allowlist entry to be AI-resolvable.

## 12. Implementation notes

- Suggested phasing (for Task Master task generation at implementation time):
  - **Phase 1 — Data layer**: table + migration, Zod 6-file set, service +
    permissions, seed fixtures + manifest + dual-write guard update.
  - **Phase 2 — Proximity search (API)**: POI resolution + accommodation search
    "near POI", consuming `geo.ts`.
  - **Phase 3 — AI search**: `poi-allowlist.ts` + `poi-resolver.ts` +
    `buildAllowlistLines` wiring + `poiSlugs` intent slot.
  - **Phase 4 — Destination detail (web)**: API hydration + `DestinationPOISection.astro`.
  - **(Deferred) Phase 5**: multi-marker map pins (extend `LocationMap`).
- Reuse `@repo/db` `utils/geo.ts` directly. Pass POI's numeric `lat`/`long`
  columns to `buildHaversineDistanceExpr` — no JSONB extraction, no `::numeric`.
- Mirror `attraction` for every layer (schema/service/seed) to stay consistent;
  the only structural divergences are: 1:N instead of M2M, and real coordinate
  columns.
- Cross-check every AI allowlist slug against the seed JSON before shipping
  (HOS-111 T-009 lesson).

## 13. Linear

Canonical tracking:
HOS-113

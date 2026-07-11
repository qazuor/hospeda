# Closeout — AI search chat — panel UX, geo "nearby destinations", attractions & conversational intent

Linear:
HOS-111

## What shipped

### Phase 1 — Panel UX + bug confirmation (T-001..T-009, G-1..G-8, G-10)

- Compact `ResultCard` with overlaid star + accommodation-type badges, reduced
  vertical footprint (AC-1).
- Results container given a distinct themed background from the chat thread
  (AC-2).
- Single unified panel header, a11y labels preserved (AC-3).
- Prominent found-results count treatment (AC-4).
- Maximize toggle: widens the chat drawer to ~60% viewport, reversible, page
  stays visible behind it (AC-5, OQ-1 resolved).
- Compact filter chips derived from **applied params**, not the raw LLM
  intent — a dropped intent field (e.g. `maxGuests`) no longer renders a
  phantom chip (AC-6).
- State-aware input placeholder: initial / has-results / no-results copy
  (AC-7, OQ-5 resolved).
- Bug #8 ("cards drop from 2 columns to 1 on re-search") reproduced and
  confirmed as the reachable empty-state, not a CSS regression; empty-state
  and results-grid made visually distinct (AC-8).
- NL amenity/feature allowlist audited and extended: pets, smoking (inverse
  framing — `smoke_free` amenity vs `smoking_area` feature), A/C
  (`air_conditioning`, fixed underscore-vs-hyphen bug), river/beach-front via
  existing `river_front`/`spa_front` features (AC-10).

### Phase 2 — Geo "nearby destinations" (T-010..T-014, G-9)

- Extracted `buildHaversineDistanceExpr`/`buildWithinRadiusClause`/
  `buildDistanceOrderByExpr` from the private, duplicated formulas in
  `accommodation.model.ts` into `packages/db/src/utils/geo.ts` — the shared
  Haversine helper HOS-113 (POI) depends on.
- `DestinationModel.findNearby` / `DestinationService.getNearby`: fixed
  ~50 km radius (tunable constant), guarded by `coordinates IS NOT NULL` +
  public/active visibility, with a fallback to the N nearest destinations
  when the radius returns zero rows (OQ-2 resolved).
- `expandToNearby` intent slot + prompt reinforcement so conversational
  follow-ups ("y en destinos cercanos") set the signal from message history.
- Search-chat handler resolves the anchor's neighbors and widens
  `params.destinationIds` (anchor + neighbors); the resolved set is emitted
  in the `filters` SSE frame's `nearbyDestinations` field.
- Web panel renders which destinations were included (AC-9).

### Phase 3 — Attractions from chat (T-015/T-016/T-018/T-019, G-11)

- `attractionSlugs` intent slot added to `SearchIntentEntitiesSchema`,
  mirroring `amenitySlugs`/`featureSlugs`.
- Curated `ATTRACTION_ALLOWLIST` (`apps/api/src/routes/ai/protected/
  attraction-allowlist.ts`) — carnaval (the spec's worked example), thermal
  springs, museums, historic center — every slug cross-checked against real
  seed data (`packages/seed/src/data/attraction/*.json`) and against which
  destinations actually carry it (`attractionIds` on
  `packages/seed/src/data/destination/*.json`), following the T-009 lesson
  that slug drift ships silently broken without that cross-check.
- `AttractionModel.findDestinationIdsBySlugs` (packages/db) +
  `AttractionService.getDestinationIdsByAttractionSlugs` (packages/service-core)
  — bulk slug → destination-ids resolution via `r_destination_attraction`,
  the slug-bulk sibling of the existing single-UUID
  `getDestinationsByAttraction`. No accommodation↔attraction join was added
  (MVP resolves by destination only, per spec §6 Phase 3).
- Multi-`destinationId` filter (`params.destinationIds`) on the accommodation
  search was **already implemented** by Phase 2 (T-013) — reused as-is, not
  re-implemented.
- `attraction-resolver.ts`: pure `combineAttractionDestinationConstraint`
  (intersect-or-**no-match**) + thin async `resolveAttractionConstraint`
  wrapper, wired into the search-chat handler as Step 7.6. Design decision
  (**owner-decided**): when both an attraction constraint and an existing
  location constraint (nearby-expansion OR a resolved `destinationId`) are
  present in the same turn, the two are INTERSECTED; on an EMPTY intersection
  (or an attraction that matches no destination at all) the turn is a
  **NO-MATCH** — the search returns ZERO accommodations and the assistant
  explains the conflict ("no encontré destinos que combinen Chajarí con
  carnaval; probá aflojando un filtro"), NOT a silent substitution of the
  attraction's destinations. The zero-results guarantee lives in the web
  client (`useSearchChat.ts`), which skips the accommodation search entirely
  on the `attractionLocationConflict` signal — an empty `destinationIds`
  array can NOT be used to force zero (the query builder treats it as "no
  filter" → full catalog). Never fatal — an infra failure (service
  error/throw) still degrades to "skip the constraint", never a false
  no-match. (AC-11).

## PRs

- #2206 — Phase 1 (panel UX + bug confirmation)
- #2212 — Phase 2 (geo nearby destinations)
- Phase 3 (this branch, `feat/hos-111-attractions`) — not yet opened as a PR;
  implementation + tests complete, pending review

## Tests

- `pnpm --filter @repo/schemas test -- ai-search-intent` — 81 passed
- `pnpm --filter @repo/db test -- attraction.model` — 24 passed
- `pnpm --filter @repo/service-core test -- attraction` — 91 passed
- `pnpm --filter hospeda-api test -- attraction-allowlist attraction-resolver amenity-allowlist search-chat.prompt-builder search-intent.mapper` — 250 passed
- `pnpm --filter @repo/schemas typecheck`, `pnpm --filter @repo/db typecheck`,
  `pnpm --filter @repo/service-core typecheck`, `pnpm --filter hospeda-api typecheck` — all green
- AC-11 end-to-end coverage added to
  `apps/api/test/integration/ai/search-chat.test.ts` (Gate 10) — type-checks
  clean under the default `tsc --noEmit` run, but only EXECUTES under
  `pnpm test:e2e` (real Postgres), same as the pre-existing AC-9 suite — see
  Follow-ups (HOS-118).

## Smoke notes

Not yet run against staging — Phase 3 has no schema/migration change and
reuses Phase 2's `destinationIds` filter, so risk is scoped to intent
extraction + a new read-only DB resolution path. Recommend a manual
"una ciudad con carnavales" / "cabaña en Colón con carnavales" smoke against
staging before merge.

## Env vars

None added or changed in any phase.

## Migrations

None. All three phases reuse existing tables/columns
(`attractions`, `r_destination_attraction`, `destinations.location`,
`accommodations.destinationId`) — no schema or migration changes at any
phase, per spec §7.

## Follow-ups

- **HOS-113** (Points of interest) — depends on the Haversine helper
  extracted in Phase 2 (`packages/db/src/utils/geo.ts`). Out of scope here
  by design (spec NG-4 / OQ-4).
- **HOS-118** — CI gap: `apps/api/test/integration/ai/search-chat.test.ts`
  (including the new AC-11 Gate 10 cases) only runs under the e2e config
  (`vitest.config.e2e.ts`, real Postgres), not under the default `pnpm test`
  CI job. Not fixed as part of this spec — flagged for a dedicated follow-up.
  Core logic (attraction slug matching, the intersect-or-fallback
  combination rule, and the resolver's non-fatal error handling) has
  separate CI-executed unit coverage
  (`apps/api/test/routes/ai/protected/attraction-{allowlist,resolver}.test.ts`)
  specifically to de-risk this gap.
- Phase 3's attraction allowlist is intentionally curated, not exhaustive
  (carnaval, thermal springs, museums, historic center) — extend it the same
  way Phase 1 extended the amenity/feature allowlists, verifying every new
  slug against `packages/seed/src/data/attraction/*.json` first.

## Decisions preserved

- **OQ-1 (Maximize)**: ~60% viewport drawer widen, reversible, not a
  full-screen modal.
- **OQ-2 (Nearby definition)**: fixed ~50 km radius via constant, fallback to
  N nearest when the radius is empty. No UI config.
- **OQ-3 (beach/river proximity)**: handled via existing `features`
  (`river_front`/`spa_front`), not attractions, not POI.
- **OQ-4 (POI)**: out of scope, moved to HOS-113.
- **OQ-5 (placeholder copy)**: Rioplatense copy defined in spec §6, "aflojar
  un filtro" phrasing dropped.
- **Phase 3 attraction + nearby/city combination (T-016, owner-decided)**:
  intersect the attraction-matched destination set with any existing location
  constraint; on an EMPTY intersection (or an attraction that matches no
  destination) the turn is a NO-MATCH — ZERO results + the assistant explains
  the conflict, NOT a silent substitution of the attraction destinations. The
  web client enforces the zero-results guarantee by skipping the search on the
  `attractionLocationConflict` signal (an empty `destinationIds` array would be
  read as "no filter" → full catalog, so it can never force zero). Infra
  failures still degrade to "skip the constraint", never a false no-match.

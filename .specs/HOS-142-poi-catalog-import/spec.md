---
title: Import the 914-POI catalog (dedicated seed group + dual-write)
linear: HOS-142
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - db
  - content
---

# Import the 914-POI catalog (dedicated seed group + dual-write)

## 1. Summary

Wire the cleaned, HOS-141-produced dataset of 914 points of interest (22
destinations) into the live seeding system: baseline JSON fixtures in a
**dedicated seed group** (not `--required`, which runs on every fresh test
DB), a **dual-write data-migration** (HOS-25) so already-seeded
staging/prod get the same rows without a full reset, and two small
consumption sub-tasks that only become worthwhile once the catalog is this
large — surfacing proximity search in the web search UI, and feeding the AI
search allowlist from the dataset's `keywords`.

## 2. Problem

- HOS-113 shipped POIs as a `--required` group with 12 hand-curated fixtures.
  `--required` runs on **every** fresh test/dev DB (`pnpm db:fresh-dev`,
  integration test setup, first-time production bootstrap). Importing 914
  rows the same way would add 914 extra inserts (+ relation + category rows)
  to every one of those paths, most of which have zero need for the full
  production catalog (a unit/integration test asserting "creating an
  accommodation succeeds" gains nothing from 914 POIs existing, and pays the
  seed-time cost on every run).
- The 914 rows ARE real, permanent production content (not demo/example data,
  not dev-only test fixtures) — so they cannot go through `--example`
  (dev/demo-only, and explicitly excluded from the production day-1 bootstrap
  per `docs/deployment/first-time-setup.md` Phase 4) or the `--test-users`
  group (dev-only accounts) either. Neither existing "not `--required`" group
  fits.
- The dataset depends on infrastructure that does not exist yet: HOS-138's v2
  columns, HOS-139's `poi_categories` catalog + `r_poi_category` join,
  HOS-140's `relation` column on `r_destination_point_of_interest`, and
  HOS-141's cleaned/geocoded/normalized/deduplicated data. Without all four,
  there is nothing valid to import.
- Once imported, the catalog is large enough that two existing but
  under-powered features finally become worth activating: proximity search
  (server-side logic already ships per HOS-113 §6.2, but no UI entry point
  exists) and the AI allowlist (`POI_ALLOWLIST` in
  `apps/api/src/routes/ai/protected/poi-allowlist.ts` currently hand-covers
  only the original 12 POIs).

## 3. Goals

- **G-1** Baseline JSON fixtures for all 914 POIs land under
  `packages/seed/src/data/pointOfInterest/` (continuing the existing
  `NNN-point-of-interest-<slug>.json` numbering from `013` onward), sourced
  1:1 from HOS-141's staged pipeline output, with a byte-for-byte count check
  (914 new files, no drops, no duplicates against the existing 12).
- **G-2** These 914 fixtures are seeded through a **dedicated, new seed
  group** — not `--required`, not `--example`, not `--test-users` — that IS
  included in every path that needs real production content (production day-1
  bootstrap, `pnpm db:fresh`, `pnpm db:fresh-dev`) but is NOT part of the
  `--required` group other consumers depend on staying small/fast.
- **G-3** A dual-write data-migration (`packages/seed/src/data-migrations/0010-*.ts`,
  HOS-25) inserts the same 914 POIs + their destination relations (with
  `relation: PRIMARY|NEARBY`, HOS-140) + category assignments (with
  `isPrimary`, HOS-139) into an already-seeded staging/prod DB, idempotently
  (insert-if-missing, same pattern as `0009-hos-113-points-of-interest.ts`).
- **G-4** `manifest-required.json` (or a new dedicated manifest, per G-2's
  group split) lists all 914 fixture files; `packages/seed/src/required/pointsOfInterest.seed.ts`
  (or its dedicated-group equivalent) reads the full set.
- **G-5** `pnpm db:fresh-dev` produces exactly 914 POIs, their destination
  relations, and their category assignments, with zero errors.
- **G-6** Proximity search gets a real entry point in the web search UI
  (server-side `poiId`/`poiSlug` resolution already ships per HOS-113 §6.2 —
  this is UI wiring only, no new API/service logic).
- **G-7** The AI search allowlist (`POI_ALLOWLIST`) is extended to cover a
  meaningful subset of the 914 POIs, sourced from each POI's `keywords`
  array (HOS-138 column), not just the original 12.

## 4. Non-goals

- **NG-1** Geocoding, category normalization, slug dedup, or destination-slug
  reconciliation. All of that is HOS-141's output; this spec treats it as a
  frozen, trusted input.
- **NG-2** Admin CRUD for POIs. Out of scope here (still deferred per HOS-113
  NG-5 until its own follow-up spec); this catalog is imported by seed only.
- **NG-3** Building a NEW proximity-search API surface. The `poiId`/`poiSlug`
  accommodation-search params, `resolvePoiToCoordinates`, and the 5km default
  radius already ship (HOS-113 §6.2/OQ-5). G-6 is a UI consumer of that
  existing contract, not a new one.
- **NG-4** Rewriting the AI allowlist matching algorithm
  (`matchPoiTerms`/substring matching) or the resolver
  (`resolvePoiConstraint`/precedence rules). G-7 only adds MORE entries to the
  existing `POI_ALLOWLIST` dictionary using the existing shape and matching
  code.
- **NG-5** A map/visual layer for the destination POI section, or multi-marker
  pins. Still deferred (HOS-113 NG-3/OQ-4), unaffected by catalog size.
- **NG-6** Auto-translating `nameI18n`/`descriptionI18n`'s `en`/`pt` fields.
  HOS-141 leaves them `null`; this spec imports them as-is. A translation pass
  is a separate follow-up.

## 5. Current baseline

- **Existing POI seed wiring** (HOS-113, unmodified by this spec's
  prerequisites): `packages/seed/src/required/pointsOfInterest.seed.ts`
  (`createSeedFactory`, `folder: 'src/data/pointOfInterest'`,
  `files: requiredManifest.pointsOfInterest`), 12 fixture files, entry in
  `packages/seed/src/manifest-required.json`. Relations to destinations are
  seeded via `pointOfInterestIds` arrays on the destination fixtures
  themselves (e.g. `packages/seed/src/data/destination/002-destination-colon.json`),
  consumed by a `pointOfInterestRelationBuilder` step in
  `destinations.seed.ts`.
- **Existing dual-write precedent**:
  `packages/seed/src/data-migrations/0009-hos-113-points-of-interest.ts` —
  reads the same fixture JSON via `loadJsonFiles`, reuses
  `normalizePointOfInterestSeedItem`, resolves both POIs and destinations by
  `slug` (never a hardcoded UUID, since POIs have no deterministic-id option),
  inserts POIs then relations, both insert-if-missing. **This exact pattern
  scales to 914 rows** — the only change needed is which fixture files/
  destination files it reads and iterating the (larger) relation set,
  including `relation: NEARBY` rows HOS-140 introduces (0009 only ever wrote
  implicit `PRIMARY` relations, since HOS-113's join table had no `relation`
  column yet).
- **Seed group precedent for a 4th top-level group**: `--test-users` already
  proves the orchestrator (`packages/seed/src/index.ts`'s `runSeed`,
  `packages/seed/src/cli.ts`'s flag parsing) supports more than
  `required`/`example` — it has its own top-level `src/test-users/` folder,
  its own CLI flag (`--test-users`), and its own chaining rule (only
  `pnpm db:fresh-dev` calls it, `pnpm db:fresh`/`pnpm db:seed` do not). This
  spec's new group follows the same mechanical shape, with a DIFFERENT
  chaining rule (§6.2 — it must ship in every "real content" path, unlike
  test-users which must ship in NONE of the production-shaped paths).
- **`check-seed-dual-write.sh`** already guards `data/pointOfInterest/**`
  (`scripts/check-seed-dual-write.sh`, guarded-paths list) — no update needed
  there regardless of which orchestrator group reads that folder, since the
  guard keys off the fixture PATH, not the seed-group mechanism.
- **AI allowlist** (`apps/api/src/routes/ai/protected/poi-allowlist.ts`):
  `POI_ALLOWLIST: Record<locale, Record<nlTerm, slug[]>>`, `matchPoiTerms()`.
  Currently hand-curated for exactly the 12 original POIs (verified: every
  `es`/`en`/`pt` block maps only to the 12 original slugs). A companion test
  (`apps/api/test/routes/ai/protected/poi-allowlist.test.ts`) cross-checks
  every allowlisted slug against the real seed fixture set (R-4 hallucination
  defence, HOS-111 T-009 lesson) — this test's assertion needs to keep
  holding at 914 fixtures, and its coverage expectation needs to grow from
  "every slug is in the 12-fixture set" to "every slug is in the 914-fixture
  set", without requiring every one of the 914 to have an allowlist entry
  (G-7 covers "a meaningful subset", not all 914 — see OQ-2).
- **Proximity search UI gap**: `apps/web/src/components/shared/filters/filter-types/GeoRadiusFilter.tsx`
  already renders a composite geo filter with a `mode: 'destination'` path
  (`config.destinationOptions`, each `{ value, label, lat, long }`) that
  resolves to a fixed center + radius via `filter-reducer.ts`'s `SET_GEO`
  action — but it only supports destination centroids, never a specific POI.
  There is currently **no** `poiId`/`poiSlug` UI entry point anywhere in
  `apps/web` (verified: no occurrence of `poiId`/`poiSlug` under
  `apps/web/src`) despite the API already accepting them (HOS-113 §6.2). With
  only 12 POIs this gap wasn't worth closing; at 914 it clearly is.
- **Production day-1 bootstrap** (`docs/deployment/first-time-setup.md` Phase
  4, line 777): `pnpm --filter @repo/seed seed --required --exclude=users` —
  this command must be updated to also include the new group's flag (G-2),
  or the production catalog never gets seeded on a fresh production DB.

## 6. Proposed design

### 6.1 Fixture placement

Copy HOS-141's staged output (`.specs/HOS-141-poi-data-pipeline/`'s pipeline
output directory, per that spec's §6.4) into
`packages/seed/src/data/pointOfInterest/`, numbered `013`–`926` (continuing
past the 12 existing files), named
`NNN-point-of-interest-<final-slug>.json` (matching the existing convention).
A companion script (or a one-off reviewed diff) verifies: exactly 914 new
files, zero filename collisions with the existing 12, and every file parses
against the HOS-138 Zod create schema before being committed (fail the copy
step loudly on any row that doesn't validate — catching anything HOS-141's
pipeline might have missed).

### 6.2 Dedicated seed group (G-2) — design decision

**Chosen**: a new top-level `src/pointOfInterestCatalog/` folder (mirroring
`src/required/`, `src/example/`, `src/test-users/` shape:
`packages/seed/src/pointOfInterestCatalog/index.ts` +
`pointsOfInterestCatalog.seed.ts`, reusing the same `createSeedFactory` +
`normalizePointOfInterestSeedItem` HOS-113 already built), gated by a new
`--poi-catalog` CLI flag in `cli.ts`, wired into `runSeed()`'s options exactly
like `testUsers` is today.

**Chaining rule (the actual novel part — different from every existing
group)**: `--poi-catalog` must run in EVERY path that seeds real permanent
content, since this catalog is production data, not demo/test data:

- `pnpm db:fresh` (`--reset --required --example` today) → add
  `--poi-catalog`.
- `pnpm db:fresh-dev` → add `--poi-catalog` alongside its existing
  `--test-users` chain step.
- `pnpm db:seed` (full local dev reset+reseed) → add `--poi-catalog`.
- **Production day-1 bootstrap** (`docs/deployment/first-time-setup.md`
  Phase 4) → the documented command becomes
  `pnpm --filter @repo/seed seed --required --poi-catalog --exclude=users`.
  This doc MUST be updated in the same PR (a stale doc here means a fresh
  production DB silently ships with zero POIs, discovered only much later).

Two alternatives were considered and rejected:

1. **Fold into `--required` with no group split.** Rejected: this is exactly
   the bloat problem G-2 exists to avoid — every integration test, every
   CI fixture reset, and every throwaway local dev DB that only needs
   `--required` for FK-satisfying baseline data (roles, amenities, tags, ...)
   would pay 914 extra POI + relation + category inserts for no benefit. The
   approved plan explicitly calls this out (decision 7: "Estrategia de seed:
   914 POIs NO van en el grupo `--required`").
2. **Fold into `--example`.** Rejected: `--example` is dev/demo-only and is
   explicitly EXCLUDED from the production bootstrap command (Phase 4 uses
   `--required --exclude=users` only, never `--example`) — a real, permanent
   production catalog cannot depend on a flag that is never set in
   production.

A new dedicated group (matching the `--test-users` precedent's MECHANISM, but
with an inverted chaining policy — test-users must NEVER run in production,
this group must ALWAYS run there) is the only option that satisfies both "not
bloating `--required`" and "still real content everywhere it needs to be".

### 6.3 Dual-write data-migration (G-3)

`packages/seed/src/data-migrations/0010-hos-141-142-poi-catalog-expansion.ts`,
mirroring `0009-hos-113-points-of-interest.ts`'s exact shape:

1. Load the 914 fixture files (`loadJsonFiles('pointOfInterest', [...913
   filenames...])`), reuse `normalizePointOfInterestSeedItem` unchanged (no
   normalizer changes needed — HOS-138's new columns are plain fields on the
   same fixture shape the existing normalizer already passes through via its
   `...cleanData` spread).
2. For each POI: `findOne({ slug })` → skip if exists, else `create()`
   (idempotent by unique `slug`, same as 0009).
3. For each POI's destination relation (sourced from HOS-141's
   `destination-relations.json` fragment, not from `pointOfInterestIds` on
   destination fixtures — the 914-row dataset is too large to hand-edit 22
   destination JSON files the way HOS-113 hand-edited 6): resolve destination
   by (reconciled) slug, resolve POI by slug, `findOne({ destinationId,
   pointOfInterestId, relation })` → skip if exists, else `create()` with the
   `relation` column HOS-140 adds (idempotent; note the composite PK is
   `(destinationId, pointOfInterestId)` per HOS-113 baseline — HOS-140's plan
   explicitly moves `relation` OUT of the PK so the same POI can be BOTH
   PRIMARY for one destination and NEARBY for another as two separate rows;
   this migration's idempotency check must therefore key on
   `(destinationId, pointOfInterestId, relation)`, not just the pair, to
   avoid silently skipping a legitimate second row).
4. For each POI's categories (from the fixture's `categories: [{slug,
   isPrimary}]` array, HOS-139): resolve category by slug, `findOne({
   pointOfInterestId, categoryId })` → skip if exists, else `create()` with
   `isPrimary`.
5. `destructive: false` (every operation is insert-if-missing, nothing is
   ever deleted or overwritten — same rationale as 0009).

### 6.4 Manifest wiring (G-4)

Either extend `manifest-required.json` with the 914 new filenames under a
`pointOfInterestCatalog` key (parallel to the existing `pointsOfInterest` key
used by the `--required` 12), or introduce a small dedicated manifest file
colocated with the new `src/pointOfInterestCatalog/` folder — implementation
detail, not user-facing; either satisfies G-4 as long as the seed factory's
`files` list is generated/reviewable rather than hand-typed 914 times (a tiny
build-time glob or a generated JSON array committed alongside the fixtures).

### 6.5 Proximity search UI (G-6)

Extend `GeoRadiusFilter.tsx`'s existing mode picker
(`destination`/`browser`) with a third mode, **`poi`**: an autocomplete/select
sourced from a new lightweight public POI-list endpoint (or the existing
destination-scoped POI list, if the search page already has the relevant
destination context) offering the featured/high-priority subset of the 914
POIs (not all 914 in a flat `<select>` — see OQ-1), each resolving to
`{ poiId, radius }` instead of raw `{ lat, long }`. `filter-reducer.ts`'s
`SET_GEO` action and `GeoRadiusState` type gain a `poiId`/`poiSlug` variant
(mirroring the existing `destId` field's precedent) that the accommodation
search page forwards as the `poiId`/`poiSlug` query param HOS-113 already
consumes server-side — reusing the EXACT existing API contract, not inventing
a new one (NG-3).

### 6.6 AI allowlist expansion (G-7)

Extend `POI_ALLOWLIST` (`apps/api/src/routes/ai/protected/poi-allowlist.ts`)
with entries derived from each seeded POI's `keywords` array (HOS-138 column,
100%-populated per HOS-141's passthrough): for each POI with `isFeatured:
true` or `priority`-derived `displayWeight >= 80` (i.e., the former `HIGH`
tier), add its `keywords` (and `nameI18n.es`, lowercased) as NL terms mapping
to its slug, following the exact same per-locale/dedup/no-invented-slug
discipline the existing 12 entries already use (§HOS-113 R-4). NOT all 914 —
see OQ-2 for scope. Every added slug is cross-checked against the real seed
fixture set by the existing `poi-allowlist.test.ts` guard (which must keep
passing at 914 fixtures, not just the original 12).

## 7. Data model / contracts

- **No schema changes** in this spec — HOS-138/139/140 own all DDL. This spec
  is fixtures + seed wiring + data-migration + two consumer features only.
- **Fixture shape**: identical to HOS-141's §7 output contract (already
  matches HOS-138's frozen v2 columns + HOS-139's `categories[]` array).
- **New CLI flag**: `--poi-catalog` (`packages/seed/src/cli.ts`), parsed
  alongside `--required`/`--example`/`--test-users`; `runSeed()`'s
  `SeedOptions` type gains a `pointOfInterestCatalog?: boolean` field.
- **New data-migration**: `packages/seed/src/data-migrations/0010-*.ts`,
  `meta.group: 'required'` (matches 0009's precedent — the `seed_migrations`
  ledger's `group` field tracks WHICH kind of migration this is for reporting
  purposes; it does not have to equal the new orchestrator flag name).
- **API contract for G-6**: none new — reuses `poiId`/`poiSlug` query params
  on the existing accommodation search endpoint (HOS-113 §6.2/OQ-5), a
  400 `VALIDATION_ERROR` if both are supplied, 404 `NOT_FOUND` if unresolvable
  (already-shipped behavior, just newly reachable from the UI).
- **`POI_ALLOWLIST` shape**: unchanged
  (`Record<locale, Record<nlTerm, readonly slug[]>>`) — this spec only adds
  entries, never changes the type.

## 8. UX / UI behavior

- **G-5 (seed)**: no end-user UX; verified via `pnpm db:fresh-dev` + a row
  count assertion.
- **G-6 (proximity UI)**: a new "near a landmark" mode in the existing geo
  filter UI on the accommodation search/listing page. Selecting a POI and a
  radius preset (5/10/25/50/100km, existing presets) re-runs the search
  centered on that POI, exactly as selecting a destination centroid does
  today — same loading/empty/error states the existing `destination` mode
  already has (no new state machine). Empty state: if the resolved POI has no
  accommodations within the chosen radius, the existing "no results" empty
  state renders unchanged (server already returns an empty, valid result set
  for an over-narrow radius — no new empty-state design needed).
- **G-7 (AI allowlist)**: no direct UI — surfaces as improved AI search chat
  answers when a user mentions a landmark beyond the original 12 (e.g. "cerca
  de la plaza San Martín de Colón" now resolves, where before it silently
  matched nothing).

## 9. Acceptance criteria

- **AC-1** `packages/seed/src/data/pointOfInterest/` contains exactly 926
  files (12 original + 914 new) after this spec merges; zero duplicate
  `slug` values across all 926.
- **AC-2** `pnpm db:fresh-dev` completes with zero errors and results in
  exactly 926 rows in `points_of_interest`, the correct relation-row count in
  `r_destination_point_of_interest` (PRIMARY rows = 914 + the 6 pre-existing
  HOS-113 relations; NEARBY rows = the count of resolved
  `nearbyDestinationSlugs` entries from HOS-141's output), and the correct
  `r_poi_category` row count (sum of each POI's `categories[]` length).
- **AC-3** Running `pnpm db:seed:migrate` twice in a row against the same DB
  is a no-op the second time (0 created, all skipped) — data-migration
  `0010-*` is idempotent (G-3).
- **AC-4** The production day-1 bootstrap command in
  `docs/deployment/first-time-setup.md` Phase 4 is updated to include
  `--poi-catalog`, and a test/checklist item confirms the updated command
  actually seeds the catalog (not just a doc-only edit).
- **AC-5** No existing consumer of `--required` (integration test setup,
  any other `pnpm --filter @repo/seed seed --required` invocation) gains the
  914 extra rows — the new group is verifiably NOT part of `--required`'s
  file set (a test asserts `requiredManifest.pointsOfInterest` still has
  exactly its pre-HOS-142 length, i.e. 12).
- **AC-6** The web accommodation search UI exposes a POI-based proximity
  entry point (G-6); selecting a POI + radius and submitting the search
  results in a request carrying `poiId` (or `poiSlug`) and no raw
  `latitude`/`longitude` for that mode, verified by an integration/component
  test on the filter reducer + page wiring.
- **AC-7** `poi-allowlist.test.ts`'s "every allowlisted slug exists in the
  real seed fixture set" guard passes against the full 926-fixture set, and
  the allowlist's total entry count strictly increases from the pre-HOS-142
  baseline (proving G-7 actually added coverage, not just re-validated the
  existing 12).
- **AC-8** `check-seed-dual-write.sh` passes on the PR that edits
  `packages/seed/src/data/pointOfInterest/**` (i.e., the guard correctly
  requires — and finds — the companion `0010-*.ts` data-migration in the same
  PR).

## 10. Risks

- **R-1 Chaining a new group into `pnpm db:seed`/`pnpm db:fresh` slows down
  every full local reset by however long 914 inserts + relations +
  categories take.** Mitigation: batch the seed factory's inserts (already
  the case per `createSeedFactory`'s existing loop shape) and measure before
  merging; if `db:fresh-dev` regresses meaningfully, consider a `--poi-catalog`
  opt-OUT flag for the tightest local iteration loop instead of opt-in
  (flagged as OQ-3, not decided here).
- **R-2 The 22-destination relation-wiring can't reuse HOS-113's
  hand-edited-`pointOfInterestIds`-on-destination-fixture pattern at this
  scale** (§6.3 point 3) — a new relation-sourcing mechanism (HOS-141's
  `destination-relations.json`) is being introduced for the first time in
  this migration. Mitigation: the migration script logs per-destination
  created/skipped/not-found counts (mirroring 0009's `counts` object) so a
  wiring bug surfaces immediately as a lopsided count instead of silently
  under-seeding one destination.
- **R-3 Production bootstrap doc drift** (§5's baseline finding) — if
  `docs/deployment/first-time-setup.md` isn't updated in lockstep, a future
  fresh production DB silently ships with zero POIs and nobody notices until
  a feature that depends on them (destination page, AI search) is checked.
  Mitigation: AC-4 makes the doc update part of the AC, not an afterthought.
- **R-4 `--poi-catalog`'s "run everywhere except test-users' dev-only
  exclusions" chaining rule is genuinely new and easy to get one path
  wrong** (four separate call sites: `db:fresh`, `db:fresh-dev`, `db:seed`,
  production Phase 4 doc). Mitigation: a single checklist/test enumerates all
  four and is checked off explicitly in this spec's own closeout, not left to
  memory.
- **R-5 AI-allowlist scope creep temptation** — it would be easy to try to
  cover all 914 POIs' keywords at once, but a bad/ambiguous keyword (e.g. a
  bare "plaza" or "museo" that matches dozens of unrelated POIs) would
  reintroduce the exact hallucination-adjacent risk HOS-113 R-4 defends
  against, just via an over-eager allowlist entry instead of an LLM
  invention. Mitigation: G-7/OQ-2 deliberately scope to featured/high-priority
  POIs with specific-enough keywords, not a blind bulk import of the
  `keywords` column.

## 11. Open questions

- **OQ-1 (POI picker UX at 914 scale)** — the `GeoRadiusFilter`'s new `poi`
  mode needs a selectable list, but 914 entries in a flat `<select>` is
  unusable. Options: (a) scope the picker to only `isFeatured`/high-priority
  POIs (recommended — mirrors the `destination` mode's existing
  `featured`-badge precedent, keeps the list short and curated); (b) a
  searchable autocomplete against the full 914 (more powerful, more
  implementation work: needs a debounced query endpoint); (c) scope by the
  destination already selected elsewhere in the search filters (contextual,
  but requires the POI list endpoint to accept a `destinationId` filter,
  which does not exist yet). Needs sign-off before building §6.5 — this spec
  recommends (a) for the first iteration, with (b)/(c) as natural follow-ups
  once usage data shows demand.
- **OQ-2 (AI allowlist coverage scope)** — "meaningful subset" (G-7) needs a
  concrete cutoff. Recommended: `isFeatured: true` OR `displayWeight >= 100`
  (the former `priority: HIGH` tier, ~659/914 rows per HOS-141's measured
  distribution) — still a lot, so a tighter cut (e.g. `isFeatured` only, a
  much smaller curated set) may be preferable to keep the dictionary
  reviewable by a human rather than machine-bulk-generated. Needs explicit
  sign-off given the direct tradeoff between AI-search coverage and
  allowlist-quality/reviewability (R-5).
- **OQ-3 (opt-out escape hatch for `--poi-catalog`)** — should a developer be
  able to skip the 914-row seed for a fast local iteration loop (e.g. an
  `--exclude=pointOfInterestCatalog` style flag, mirroring the existing
  `--exclude` mechanism used for `users` in production) even though this
  group is chained by default everywhere real content is needed? Recommended:
  yes, reuse the existing generic `--exclude=` flag rather than inventing a
  new one, but only decide after R-1's timing measurement shows it's actually
  needed.

## 12. Implementation notes

- Suggested phasing:
  - **Phase 1 — Fixture placement + manifest wiring**: copy HOS-141's staged
    output into `packages/seed/src/data/pointOfInterest/` (§6.1), build the
    new `src/pointOfInterestCatalog/` group + `--poi-catalog` CLI flag (§6.2),
    update `db:fresh`/`db:fresh-dev`/`db:seed` chaining + the production
    bootstrap doc (§6.2, AC-4).
  - **Phase 2 — Dual-write migration**: `0010-*.ts` (§6.3), verified
    idempotent (AC-3) and count-consistent (AC-2) against a fresh vs.
    already-`--required`-only-seeded DB.
  - **Phase 3 — Proximity search UI**: `GeoRadiusFilter`'s new `poi` mode
    (§6.5), resolving OQ-1 first.
  - **Phase 4 — AI allowlist expansion**: `POI_ALLOWLIST` additions (§6.6),
    resolving OQ-2 first, re-verifying `poi-allowlist.test.ts`'s cross-check
    guard against 926 fixtures.
- This spec depends on HOS-138 (v2 model core), HOS-139 (category catalog),
  HOS-140 (`relation` column), and HOS-141 (cleaned dataset) — do not start
  Phase 1 until all four have a stable, mergeable shape (a moving v2 column
  set would force rework of the fixture placement step).
- This spec blocks the Phase 2/3 consumer features tracked separately
  (HOS-145..150 in the approved plan's issue tree: destination map, thematic
  category filters, POI own-pages, AI itinerary, commerce bridge) — none of
  those are worth building against a 12-POI catalog; they all wait on this
  spec's completion.
- Reuse `normalizePointOfInterestSeedItem` and `getPointOfInterestEntityInfo`
  from `pointsOfInterest.seed.ts` unchanged in the new group's seed factory —
  do not fork a second copy of the normalizer logic (single source of truth
  for "how a raw POI fixture becomes a `service.create()` payload").

## 13. Linear

Canonical tracking:
HOS-142

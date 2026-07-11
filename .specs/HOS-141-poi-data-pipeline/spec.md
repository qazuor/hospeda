---
title: POI catalog data pipeline (geocode, normalize, dedup, validate)
linear: HOS-141
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - content
  - devops
---

# POI catalog data pipeline (geocode, normalize, dedup, validate)

## 1. Summary

Turn the raw, ChatGPT-assisted consolidated CSV of 914 candidate points of
interest (`/home/qazuor/Downloads/POIS/Hospeda-POIs-Consolidado.csv`, 22
destinations) into a clean, review-able dataset shaped for the POI v2 model
(HOS-138/139/140). This is a **data-quality pipeline**, not a code feature: an
idempotent, re-runnable script that geocodes missing coordinates, normalizes
free-text categories to the canonical catalog, deduplicates colliding slugs,
reconciles destination references, and reports exactly what it could and could
not resolve. Its output is the input HOS-142 imports.

## 2. Problem

The raw CSV cannot be imported as-is:

- **78% of rows have no coordinates** (717/914 `lat`/`lng` empty). POI v2 makes
  `lat`/`long` nullable (HOS-138), so an import would technically succeed, but
  it would silently produce ~700 POIs that can never participate in proximity
  search, defeating a large part of why the catalog is being built (see
  HOS-113 §6.2, `packages/db/src/utils/geo.ts`'s `buildWithinRadiusClause`,
  which requires non-null coordinates on the compared row).
- **Categories are 40 free-text ChatGPT-generated UPPER_SNAKE slugs**
  (`categorySlugs`, semicolon-separated, e.g. `SQUARE; HISTORIC_SITE; PARK`)
  with no relationship to the `poi_categories` catalog HOS-139 is building.
  Importing them verbatim would create an uncontrolled, duplicate-prone
  category catalog instead of the curated one HOS-139 defines.
- **46 POI slugs collide across destinations.** The most extreme case,
  `municipalidad`, is claimed by **16 different destinations**
  (`urdinarrain`, `villa-paranacito`, `federacion`, `ubajay`, `san-salvador`,
  `san-jose`, `ibicuy`, `ceibas`, `larroque`, `gualeguaychu`, `caseros`,
  `colon`, `santa-ana`, `rosario-del-tala`, `gualeguay`, `san-justo`); others
  include `terminal-omnibus` (13), `oficina-turismo` (10), `plaza-san-martin`
  (9). `points_of_interest.slug` is `UNIQUE` (HOS-113), so importing these
  verbatim is a hard constraint violation, not just a style problem.
- **Two of the CSV's 22 `destinationSlug` values do not match any real
  destination fixture slug**: `pueblo-liebig` (real slug: `liebig`, see
  `packages/seed/src/data/destination/007-destination-liebig.json`) and
  `villa-paranacito` (real slug: `paranacito`, see
  `packages/seed/src/data/destination/008-destination-paranacito.json`). An
  import that resolves destinations by slug naively would silently drop every
  POI for those two destinations (37 + N rows) rather than failing loudly.
- **`verified`/`source`/`notes` need to survive the transformation without
  conflating "cartographically verified" with "coordinates we just derived by
  geocoding an address string"** — the two are not the same confidence level
  and must not be recorded identically.

Cleaning this up is explicitly called out as the **priority** task ahead of the
definitive import (approved plan, decision 4) because every downstream
consumer (HOS-142's import, proximity search, the AI allowlist, the web POI
section) inherits whatever quality this step produces.

## 3. Goals

- **G-1** Geocode the 717 coordinate-less rows from their `address` field
  (100% populated), producing `{ lat, long, geocodeConfidence, geocodeSource }`
  for every row that resolves, and an explicit "unresolved" marker for every
  row that does not — no row is silently dropped.
- **G-2** Normalize the 40 free-text `categorySlugs` values to the canonical
  `poi_categories` slugs defined by HOS-139, preserving per-POI order (first
  listed category → primary) and multiplicity (a POI keeps all its mapped
  categories, not just one).
- **G-3** Deduplicate the 46 colliding POI slugs using the destination-prefix
  strategy (HOS-138 decision): a colliding bare slug becomes
  `<destinationSlug>_<poiSlug>`; the other 868 non-colliding slugs are left
  bare. Zero duplicate `slug` values in the final output.
- **G-4** Reconcile all 22 CSV `destinationSlug` values against the real,
  currently-seeded destination catalog, fixing the 2 known mismatches
  (`pueblo-liebig`→`liebig`, `villa-paranacito`→`paranacito`) via an explicit
  mapping table, and failing loudly (non-zero exit, listed in the report) on
  any `destinationSlug` the mapping table does not cover.
- **G-5** Carry `verified`/`verifiedAt`/`source`/`notes` through unmodified for
  the 159 already-verified rows, and produce a distinguishable, non-verified
  provenance trail (an appended `notes` annotation, never a change to
  `verified`) for coordinates the pipeline itself derived via geocoding.
- **G-6** Produce a re-runnable, idempotent script (safe to run repeatedly
  against the same or an updated CSV) plus a machine- and human-readable
  report: total rows, % geocoded (by confidence tier), % category-normalized,
  count of slug collisions resolved, count of destination-slug mismatches
  resolved, and an explicit list of any row that could not be fully resolved.
- **G-7** Emit the cleaned dataset as one JSON file per POI, in the exact
  v2 fixture shape (§7), staged in a pipeline-output location HOS-142 then
  copies into the live seed data folder (see §6.4 for why staged, not
  in-place).

## 4. Non-goals

- **NG-1** Wiring the cleaned dataset into the actual seed system (the
  `--required`-vs-dedicated seed group decision, `manifest-required.json` /
  a new manifest, the `createSeedFactory` call, the dual-write data-migration,
  `check-seed-dual-write.sh`). That is HOS-142's entire scope.
- **NG-2** Building the `points_of_interest` v2 schema, `poi_categories` table,
  or the `relation` column on the destination↔POI join table. Those are
  HOS-138/139/140. This pipeline's output shape is FROZEN to match what those
  land (see R-1); the pipeline does not modify any table.
- **NG-3** Manually verifying (human, cartographic) any of the 717
  newly-geocoded coordinates. Geocoding produces a best-effort automated
  coordinate, not a `verified: true` claim (G-5). Human verification of
  geocoded POIs is an explicit future follow-up, not in scope here.
- **NG-4** Building a generic/reusable geocoding SDK for other Hospeda
  features. This is a one-time, throwaway batch script scoped to this exact
  CSV; it is not `@repo/geocoding` or similar.
- **NG-5** Resolving every unresolved row. A best-effort pipeline will not
  reach 100% geocoding coverage (some addresses are too vague, e.g. a bare
  town name with no street). Unresolved rows are reported and imported later
  with `lat`/`long` left `NULL` (HOS-138 makes this valid) — not blocked on.
- **NG-6** Feeding the AI-search allowlist or exposing proximity search in the
  web UI. Both are explicitly HOS-142 sub-tasks, downstream of this pipeline's
  output existing.

## 5. Current baseline

- **Source CSV**: `/home/qazuor/Downloads/POIS/Hospeda-POIs-Consolidado.csv`,
  914 data rows (915 lines incl. header, UTF-8 BOM), columns: `id`,
  `destinationSlug`, `destinationName`, `destinationTier`, `relation`, `name`,
  `description`, `priority`, `address`, `lat`, `lng`, `verified`, `source`,
  `verifiedAt`, `notes`, `categorySlugs`, `categoryNames`, `keywords`,
  `nearbyDestinationSlugs`, `nearbyDestinationNames`.
- **Measured facts** (verified against the real file, 2026-07-11):
  - `relation` is `PRIMARY` for all 914 rows (no `NEARBY` rows exist yet in the
    raw data — those only emerge from `nearbyDestinationSlugs`, populated on
    331 rows, feeding HOS-142's NEARBY relation creation, not this pipeline).
  - `priority`: `HIGH` 659, `MEDIUM` 242, `LOW` 13.
  - `verified`: `True` 159, `False` 755.
  - `address`: 100% populated (0 empty).
  - `lat`/`lng`: 717/914 (78%) empty on both columns together (no row has only
    one of the two populated, per spot-check).
  - `categorySlugs`: 40 distinct values across the dataset, semicolon-
    separated, multi-valued per row (verified distribution: `HISTORIC_SITE`
    307, `RECREATION` 271, `TOURIST_ROUTE` 190, `NATURAL_AREA` 164,
    `EDUCATION` 160, ... down to `CASINO` 3, `OTHER` 1 — 40 total).
  - `keywords`: 100% populated, semicolon-separated.
  - `nearbyDestinationSlugs`: populated on 331/914 rows.
  - 22 distinct `destinationSlug` values; 2 do not match a real destination
    fixture slug (§2).
  - 46 distinct POI-slug segments (the part after `__` in `id`) are claimed by
    more than one destination (§2 lists the worst offenders).
  - There is also a companion `poi.schema.json`
    (`/home/qazuor/Downloads/POIS/poi.schema.json`) — a ChatGPT-authored draft
    JSON Schema for the CSV's OWN shape (singular `latitude`/`longitude`,
    `sources[]` array, `categories[]` of `{slug,name}` objects). This is
    **not** the target shape — HOS-138's frozen `points_of_interest` v2
    columns are the target (§7). Treat `poi.schema.json` as documentation of
    the CSV's pre-cleaning shape only, not a contract to satisfy.
- **Target v2 fixture shape** (HOS-138, frozen at spec-write time per the
  approved plan `/home/qazuor/.claude/plans/functional-prancing-rabin.md`):
  `slug` (unique, i18n key, snake_case per the existing 12 fixtures — see
  `packages/seed/src/data/pointOfInterest/001-point-of-interest-autodromo_concepcion_del_uruguay.json`),
  `lat`/`long` (nullable `doublePrecision`), `type` (transient, derived from
  primary category), `icon`, `description`, `isBuiltin`, `isFeatured`,
  `displayWeight`, `lifecycleState`, plus HOS-138's new columns
  (`nameI18n`, `descriptionI18n`, `translationMeta`, `address`, `keywords`,
  `hasOwnPage`, `verified`, `verifiedAt`, `source`, `notes`) and HOS-139's
  category M2M (`categories: [{slug, isPrimary}]` at the fixture level, wired
  to `r_poi_category` by HOS-142).
- **Existing naming convention**: both the 12 shipped POI fixtures
  (`autodromo_concepcion_del_uruguay`, `playa_banco_pelay`, ...) and the
  amenity/feature catalog (SPEC-266; verified sample:
  `packages/seed/src/data/amenity/*.json` → `wifi`, `air_conditioning`,
  `full_kitchen`, ...) use **snake_case with underscores**, not hyphens. The
  CSV's own `id` column uses hyphens (`concepcion-del-uruguay__plaza-general-francisco-ramirez`),
  and the approved plan's own prose example for the dedup strategy
  (`concordia-municipalidad`) also uses a hyphen — that is informal prose, not
  a binding convention; see OQ-1.
- **No geocoding, category-normalization, or dedup code exists anywhere in the
  repo today.** This is 100% new, standalone tooling.

## 6. Proposed design

### 6.1 Pipeline shape

A single Node/TypeScript CLI script (not a library, not wired into
`@repo/seed`'s runtime — see NG-1/NG-4), run manually by a developer, e.g.
`packages/seed/scripts/poi-pipeline/run.ts` (exact location is an
implementation detail; keep it out of `@repo/seed`'s `src/` so it can never be
accidentally imported by the seed runtime). Stages, each independently
re-runnable and logged:

1. **Load** — parse the CSV (914 rows) into typed row objects.
2. **Reconcile destinations** — map each `destinationSlug` through a fixed
   `DESTINATION_SLUG_FIXUPS` table (`{ 'pueblo-liebig': 'liebig',
   'villa-paranacito': 'paranacito' }`); any `destinationSlug` not in the real
   destination fixture set AND not in the fixup table aborts the run with a
   clear error (fail loud, never silently drop rows — G-4).
3. **Compute final slugs** — for each row, take the POI-slug segment (right
   of `__` in `id`), convert to snake_case (OQ-1), and check for collision
   across the full 914-row set; colliding slugs get prefixed
   `<destinationSlug>_<poiSlug>` (using the RECONCILED destination slug from
   step 2, so `pueblo-liebig`'s rows prefix with `liebig`, not the raw CSV
   value). Assert zero duplicates in the output set (G-3).
4. **Normalize categories** — split `categorySlugs` on `;`, trim, map each
   through a fixed `CATEGORY_SLUG_MAP` (one entry per one of the 40 source
   values → a HOS-139 canonical `poi_categories` slug; §6.2). First entry in
   the row's (trimmed, order-preserved) list becomes `isPrimary: true` (OQ-2).
   A source category with no mapping entry aborts the run (the map must be
   exhaustive over the 40 observed values before this stage ships).
5. **Geocode** — for the 717 rows with empty `lat`/`lng`, call the geocoder
   (§6.3) with the row's `address` (+ `destinationName`, `+ ", Entre Ríos,
   Argentina"` as a fixed regional qualifier to disambiguate short/generic
   addresses). Cache every request/response pair keyed by the exact address
   string sent (§6.3.3) so re-runs never re-hit the network for a
   already-resolved address.
6. **Derive `type`** — map each POI's primary (post-normalization) category to
   one `PointOfInterestTypeEnum` value via a fixed table (the transient
   `type` column HOS-138 keeps for backward compat, per the approved plan
   decision "type queda deprecado... derivado de la categoría primaria").
7. **Carry provenance** — pass `verified`/`verifiedAt`/`source`/`notes`
   through unmodified for already-verified/sourced rows; for rows whose
   coordinates came from step 5's geocoder, force `verified: false`
   (regardless of the CSV's original value, which was already `false` for
   100% of the 717 coordinate-less rows — verified spot-check) and append a
   fixed marker to `notes` (e.g. `"Coordinates auto-geocoded from address on
   <ISO date> via <provider>; pending human cartographic verification."`) so
   a future verification pass can `WHERE notes LIKE '%auto-geocoded%'`.
8. **Emit** — write one JSON file per POI (fixture shape, §7) to a staged
   output directory, plus a `destination-relations.json` fragment (which
   reconciled-destination gets which POI, `PRIMARY` always; `NEARBY` derived
   from `nearbyDestinationSlugs` for the 331 rows that carry it, resolved
   through the SAME destination-slug reconciliation as step 2), plus
   `report.md`/`report.json` (G-6).

Idempotency (G-6): re-running the whole pipeline against the same CSV must
produce byte-identical output (deterministic slug/category/type derivation) except
where the geocode cache has grown (new addresses resolved since the last run).
Re-running against an unchanged CSV with a warm cache makes **zero** network
calls.

### 6.2 Category normalization table

A hand-reviewed, 40-entry `CATEGORY_SLUG_MAP: Record<string, string>` (source
UPPER_SNAKE CSV value → HOS-139 canonical `poi_categories` slug), covering
every value in §5's verified distribution
(`HISTORIC_SITE`, `RECREATION`, `TOURIST_ROUTE`, `NATURAL_AREA`, `EDUCATION`,
`CULTURAL_CENTER`, `SERVICES`, `PARK`, `WATERFRONT`, `SPORTS_VENUE`,
`ARCHITECTURE`, `COMMUNITY_CENTER`, `FAMILY`, `MONUMENT`, `ENTERTAINMENT`,
`INDUSTRIAL_HERITAGE`, `MUSEUM`, `FAIR`, `TRANSPORT`, `BIRDWATCHING`,
`GASTRONOMY`, `SQUARE`, `RELIGIOUS_SITE`, `BEACH`, `HIKING`, `GOVERNMENT`,
`VIEWPOINT`, `ART`, `SHOPPING`, `RESERVE`, `CAMPGROUND`, `HEALTH`, `PORT`,
`THEATER`, `NIGHTLIFE`, `THERMAL_COMPLEX`, `WELLNESS`, `WINERY`, `CASINO`,
`OTHER`). The approved plan names three worked examples
(`SQUARE→PLAZA`, `SPORTS_VENUE→STADIUM`, `NATURAL_AREA→NATURAL`); the
remaining 37 are this pipeline's own deliverable, produced in lockstep with
whatever final slug set HOS-139 seeds (the map's right-hand side must be a
subset of HOS-139's `poi_categories.slug` values — a test asserts this, §9).
The map is committed as reviewable source (a single TS/JSON file), not
inferred at runtime by any fuzzy matching — no category is ever guessed.

### 6.3 Geocoding

**Provider choice is an explicit tradeoff, left as OQ-3 for owner sign-off**
given cost/ToS implications, but the pipeline's own geocoder abstraction
(`resolveCoordinates(address): Promise<GeocodeResult | null>`) is
provider-agnostic so the choice is a one-line swap regardless of which is
picked:

| Option | Cost | Rate limit | Storage/ToS | Accuracy for this dataset |
|---|---|---|---|---|
| **Nominatim (OpenStreetMap)** — recommended | Free | 1 req/s (public instance) — 717 rows ≈ 12 min one-time | OSM data is ODbL: caching/reusing results long-term is explicitly permitted with attribution; no per-record storage restriction | Good for landmark/street addresses in Argentina; weaker for very generic addresses (bare town name) — expect a non-zero unresolved tail |
| Google Geocoding API | Paid past free tier (~$5/1000 reqs); one-time 717-row run is cheap in absolute terms | High (per-key quota) | ToS historically restricts persisting geocode results outside of a Google Map display beyond a bounded cache window — a real compliance question for a DB column kept indefinitely, not just a demo cache | Best-in-class for structured addresses |
| Mapbox Geocoding API | 100k free requests/month | High | Explicitly permits caching/storing results | Comparable to Google for this region |

Recommendation: **Nominatim** for this one-time batch — free, sufficient
volume/rate for 717 rows, and no ToS ambiguity around storing the resulting
coordinates indefinitely in `points_of_interest.lat`/`long`. Mapbox is the
fallback if Nominatim's match rate proves too low in practice (spike/dry-run
first, §12). Google is not recommended given the storage-ToS ambiguity for a
permanent catalog column (as opposed to a live map render).

#### 6.3.1 Confidence tiers

Every geocode result is tagged with a confidence tier (derived from the
provider's own match-quality signal — e.g. Nominatim's `importance`/`type`
fields) into `high` / `medium` / `low` / `unresolved`. Only `high`/`medium`
results are written to `lat`/`long`; `low`-confidence results are treated as
`unresolved` (left `NULL`, listed in the report) rather than silently
accepted — a wrong coordinate is worse than a missing one (it actively
corrupts proximity search instead of just not participating in it).

#### 6.3.2 Rate limiting

A fixed delay (≥1000ms for Nominatim's public instance, per its usage policy)
between requests, with retry-with-backoff on 429/5xx, and a hard cap on total
run time so a stalled network doesn't hang the script indefinitely.

#### 6.3.3 Cache

A flat JSON cache file (`{ [addressKey]: GeocodeResult }`, `addressKey` = the
exact string sent to the geocoder) checked into the pipeline's own working
directory (not `@repo/seed`'s runtime path), committed to the repo so the
pipeline's history/audit trail survives independent of whoever runs it next.
Re-running the pipeline is a pure cache lookup for every previously-resolved
address; only genuinely new/changed addresses hit the network.

### 6.4 Why staged output, not in-place into `packages/seed/src/data/pointOfInterest/`

**Decision**: this pipeline writes its output to a location OUTSIDE the live
seed data folder (e.g. `packages/seed/scripts/poi-pipeline/output/`), and
HOS-142 copies/moves the reviewed result into
`packages/seed/src/data/pointOfInterest/` as part of its own wiring work.

Two options were considered:

1. **Staged output, HOS-142 copies in** (chosen). Pros: keeps this pipeline
   fully decoupled from HOS-142's still-open seed-group decision (dedicated
   group vs. folding into `--required`, exact manifest shape); never risks
   900+ files landing in the folder that CURRENTLY backs the live
   `--required` seedPointsOfInterest factory before that factory's `files`
   list and group wiring are updated in the same change (which would silently
   break `db:fresh-dev` mid-pipeline, before HOS-142 lands); keeps "is the
   data clean" (this spec) and "is the wiring correct" (HOS-142) as two
   independently reviewable diffs. Cons: one extra manual copy step; needs a
   trivial count/checksum check to confirm nothing was dropped in the copy
   (folded into HOS-142's AC).
2. **Write directly into the final folder + manifest.** Pros: no copy step.
   Cons: couples this pipeline to a wiring decision it does not own (HOS-142's
   explicit scope per the approved plan: "Update
   `packages/seed/src/data/pointOfInterest/*` + the runner"); a run against an
   evolving CSV (e.g. a corrected address) would keep rewriting live seed data
   before the group split exists, risking exactly the kind of "baseline edited
   without a matching data-migration" bug HOS-25's dual-write rule exists to
   prevent.

Option 1 is recommended and assumed for the rest of this spec.

## 7. Data model / contracts

No schema/table changes (NG-2). The pipeline's **output contract** is a
directory of JSON files, one per POI, each matching HOS-138's frozen fixture
shape (mirroring `packages/seed/src/data/pointOfInterest/*.json`'s existing
field set, extended with HOS-138's new columns):

```jsonc
{
  "slug": "concordia_municipalidad",       // snake_case, collision-prefixed per §6.1 step 3
  "lat": -31.392,                           // number | null
  "long": -58.021,                          // number | null
  "type": "GOVERNMENT",                     // derived, transient (HOS-138 deprecation note)
  "icon": null,
  "description": "...",
  "nameI18n": { "es": "Municipalidad de Concordia", "en": null, "pt": null },
  "descriptionI18n": { "es": "...", "en": null, "pt": null },
  "translationMeta": {},
  "address": "...",                         // passthrough, 100% populated
  "keywords": ["...", "..."],
  "hasOwnPage": false,
  "isBuiltin": true,
  "isFeatured": false,                       // derived from priority: HIGH -> true (HOS-138 mapping)
  "displayWeight": 100,                      // derived from priority: HIGH/MEDIUM/LOW -> 100/50/10
  "verified": false,
  "verifiedAt": null,
  "source": "https://...",
  "notes": "...",
  "lifecycleState": "ACTIVE",
  "categories": [
    { "slug": "government", "isPrimary": true },
    { "slug": "community-center", "isPrimary": false }
  ]
}
```

Plus one `destination-relations.json`:

```jsonc
[
  { "destinationSlug": "concordia", "poiSlug": "concordia_municipalidad", "relation": "PRIMARY" },
  { "destinationSlug": "colon", "poiSlug": "some_nearby_poi", "relation": "NEARBY" }
]
```

Plus `report.md` (human) / `report.json` (machine): total rows in, total rows
out, geocode stats (`resolvedHigh`, `resolvedMedium`, `rejectedLowConfidence`,
`unresolved`, with the unresolved rows' `slug`s listed), category-map coverage
(should be 40/40), slug-collision count resolved (should be 46), destination
mismatches resolved (should be 2), and any hard-fail encountered.

`nameI18n`/`descriptionI18n` note: the CSV's `name`/`description` are single
Spanish strings (no multi-language source data exists yet). The pipeline
populates `es` from the CSV verbatim and leaves `en`/`pt` `null` — it does
**not** invent translations. Populating `en`/`pt` (e.g. via the same
AI-auto-translate the admin `I18nTextField` already offers, per the approved
plan §"Patterns a reusar") is out of scope here; it is a natural follow-up
either during HOS-142's admin wiring or a dedicated translation pass.

## 8. UX / UI behavior

Not applicable — this is a developer-run, offline batch pipeline with no
end-user-facing surface. Its only "UX" is the developer-facing CLI/report
(§6.1 step 8, §7's `report.md`).

## 9. Acceptance criteria

- **AC-1** Running the pipeline against the full CSV produces exactly 914
  output POI JSON files (one per input row) plus a `destination-relations.json`
  and a report — no row is silently dropped, including the 2 destination-slug
  mismatch rows (G-4).
- **AC-2** Zero duplicate `slug` values across the 914 output files (G-3);
  a test asserts this against the pipeline's actual output.
- **AC-3** Every output POI's `categories[].slug` value is a member of
  HOS-139's seeded `poi_categories.slug` set (G-2); a test cross-checks the
  `CATEGORY_SLUG_MAP`'s right-hand side against HOS-139's category fixtures
  once HOS-139 lands (if HOS-139 has not yet merged when this pipeline is
  built, the test asserts against the mapping table HOS-139's own spec
  documents, and is re-verified once HOS-139 ships — see R-1).
- **AC-4** At least 90% of the 717 previously-coordinate-less rows resolve to
  a `high`/`medium`-confidence geocode (G-1); rows that don't are listed by
  `slug` in the report, not silently zeroed out or defaulted to a
  destination centroid.
- **AC-5** No output row has `verified: true` unless the CSV's original row
  already had `verified: true` (G-5) — geocoding NEVER flips `verified` to
  `true`; a test asserts `output.verified === true` implies
  `input.verified === 'True'` for every row.
- **AC-6** Every geocoded (previously coordinate-less) row's `notes` contains
  the fixed auto-geocode marker string; every already-`verified: true` row's
  `notes`/`source`/`verifiedAt` are byte-identical to the CSV input.
- **AC-7** Re-running the pipeline twice against the same CSV with a warm
  cache produces byte-identical output on the second run and makes zero
  network calls (G-6 idempotency).
- **AC-8** The report's totals are internally consistent:
  `resolvedHigh + resolvedMedium + rejectedLowConfidence + unresolved === 717`
  and `alreadyHadCoords + (resolvedHigh + resolvedMedium) === (914 - unresolved
  - rejectedLowConfidence)`.

## 10. Risks

- **R-1 Category map depends on a not-yet-final HOS-139 catalog.** If HOS-139
  ships with different final slugs than assumed while building
  `CATEGORY_SLUG_MAP`, the map needs a follow-up pass. Mitigation: this
  pipeline can be built/run in parallel with HOS-139 (shape-independent, per
  the approved plan), but the FINAL emit (§6.1 step 8) is re-run once
  HOS-139's real fixture slugs are confirmed, before handing off to HOS-142
  (see also §12 phasing).
- **R-2 Geocoding accuracy for vague addresses.** Some `address` values are
  just a town name with no street (spot-check needed at build time); these
  will legitimately fail to resolve at high confidence. Mitigation: confidence
  tiering (§6.3.1) rejects low-confidence matches rather than accepting a
  wrong coordinate; AC-4 sets a realistic (not 100%) bar.
- **R-3 Nominatim rate limit makes the full run slow (~12+ minutes) and
  fragile to network interruption.** Mitigation: the cache (§6.3.3) makes
  re-runs cheap and resumable — an interrupted run loses at most the
  in-flight batch, not prior progress.
- **R-4 Provider ToS risk if Google is chosen instead of the recommendation.**
  Mitigation: §6.3 documents the tradeoff explicitly; OQ-3 defers the final
  call to the owner rather than assuming it.
- **R-5 Silent destination-slug drift.** If a THIRD CSV/destination-catalog
  mismatch exists beyond the 2 found during spec research, an unguarded
  pipeline would either crash unhelpfully or (worse) silently drop rows.
  Mitigation: §6.1 step 2 is fail-loud by design (an unmapped slug aborts the
  run with a clear message identifying the offending rows) rather than
  best-effort matching.
- **R-6 First-listed-category-as-primary may not always be the best choice.**
  ChatGPT's category ordering is a heuristic, not a guarantee. Mitigation:
  OQ-2 flags this as reviewable before the final emit; a spot-check of ~30
  rows across different `destinationTier`s is cheap insurance before trusting
  it across all 914.
- **R-7 snake_case-vs-hyphen slug convention inconsistency already exists in
  the approved plan's own prose.** Mitigation: OQ-1 resolves it explicitly
  against the existing 12-fixture + amenity/feature precedent (both
  snake_case) rather than silently picking one.

## 11. Open questions

- **OQ-1 (slug separator convention)** — snake_case with underscores
  (matching the 12 already-shipped POI fixtures and the amenity/feature
  catalog, e.g. `concordia_municipalidad`) vs. hyphens (matching the CSV's own
  `id` format and the approved plan's informal prose example
  `concordia-municipalidad`). **Recommended: underscores**, for consistency
  with every other seeded slug-as-i18n-key in the codebase today. Needs
  explicit sign-off since it affects all 914 output slugs and cannot be
  cheaply changed once HOS-142 seeds them into a `UNIQUE` column live on
  staging/prod.
- **OQ-2 (primary-category selection)** — first-listed category in the CSV's
  (order-preserved) `categorySlugs` becomes `isPrimary: true` (simplest, and
  ChatGPT's ordering loosely tracks relevance in spot-checked rows) vs. some
  other heuristic (e.g. rarest category across the catalog, favoring
  specificity). **Recommended: first-listed**, cheapest and good-enough per
  spot-check; flag for a light manual spot-check pass (~30 rows) before the
  final emit rather than a heavier heuristic build.
- **OQ-3 (geocoding provider)** — Nominatim (free, ToS-safe for permanent
  storage, slower/rate-limited) vs. Mapbox (fast, generous free tier,
  ToS-safe) vs. Google (fastest/most accurate, but ToS storage ambiguity for a
  permanent DB column). **Recommended: Nominatim**, with Mapbox as the
  documented fallback if a dry-run shows Nominatim's match rate is too low for
  this address set (§6.3). Needs owner sign-off given the cost/ToS tradeoff is
  explicitly a business decision, not a purely technical one.
- **OQ-4 (unresolved-row disposition)** — rows that fail geocoding entirely:
  import with `lat`/`long: null` now (matches HOS-138's nullable columns,
  simplest) vs. hold them out of the HOS-142 import entirely until a human
  fills them in later. **Recommended: import with null coordinates now** —
  they still carry `name`/`description`/`address`/`categories`/`keywords` and
  are useful for the AI allowlist and destination page listing even without
  proximity-search participation; holding them back indefinitely loses more
  value than it protects.

## 12. Implementation notes

- Suggested phasing:
  - **Phase 1 — Shape-independent work (can start now, in parallel with
    HOS-138/139/140)**: CSV loader, destination-slug reconciliation (G-4),
    category-map construction (§6.2, pending final HOS-139 slugs for the
    right-hand side but buildable against the plan's documented category list
    today), geocoding pipeline + cache + confidence tiering (§6.3), dedup
    logic (G-3). All independently testable against the raw CSV without any
    v2 schema existing yet.
  - **Phase 2 — Frozen-shape emit (blocked on HOS-138 merging)**: the final
    per-file JSON emit (§6.1 step 8, §7) using the real, merged
    `points_of_interest` v2 column set; the `type`-derivation table (needs
    HOS-138's `PointOfInterestTypeEnum` values) and the category-map's
    right-hand side (needs HOS-139's real seeded slugs) get a final
    verification pass here even if built provisionally in Phase 1.
  - **Phase 3 — Report + handoff**: generate `report.md`/`report.json`,
    spot-check OQ-2's primary-category selection on a ~30-row sample across
    `destinationTier`s, and hand the staged output directory (§6.4) to
    HOS-142.
- A dry-run mode (geocode a small sample, e.g. 20 rows, before committing to
  the full 717-row run) is strongly recommended to validate OQ-3's provider
  choice cheaply before spending the full ~12-minute rate-limited run.
- Do not build this as a `@repo/seed` runtime module (NG-4) — keep it as a
  standalone script so it can depend on things (a geocoding HTTP client) the
  seed runtime has no reason to carry as a permanent dependency.

## 13. Linear

Canonical tracking:
HOS-141

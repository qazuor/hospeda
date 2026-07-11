---
title: AI search chat — panel UX, geo "nearby destinations", attractions & conversational intent
linear: HOS-111
statusSource: linear
created: 2026-07-09
type: feature
areas:
  - web
  - api
  - db
---

# AI search chat — panel UX, geo "nearby destinations", attractions & conversational intent

## 1. Summary

Improve the AI conversational search panel (`SearchChatPanel` / `AiSearchEntry`
in `apps/web`) and extend its intent/search capabilities. This spec groups the
UX/product polish and the new search capabilities that surfaced while testing
the base intent-mapping fix (city→destinationId, min-only guests, dedup, etc.),
which ships separately. Scope spans `apps/web` (panel UX), `apps/api` (intent
resolution) and `packages/db` (geo query helpers).

> This spec is deliberately **open to further analysis and additions** once the
> base fix is merged and the panel gets more real use — the owner may add items.

## 2. Problem

The base fix made the chat return correct results, but hands-on testing exposed
two classes of gaps:

1. **Panel UX**: result cards are too tall, the results area doesn't visually
   separate from the conversation, there are two redundant headers, the result
   count is not prominent, there's no way to enlarge the panel, and the input
   placeholder is static regardless of search state.
2. **Search intelligence**: the chat can't yet act on conversational
   follow-ups that imply geography ("y en destinos cercanos"), and its coverage
   of amenities/features and destination attractions ("una ciudad con
   carnavales", "cerca de una playa") is unverified or unsupported.

## 3. Goals

- **G-1 (UX)** Compact result cards: single star + accommodation type as badges
  over the photo; reduce vertical footprint.
- **G-2 (UX)** Results area with a subtle background that differentiates it from
  the chat thread.
- **G-3 (UX)** Single unified panel header (merge "Búsqueda inteligente" +
  "Búsqueda conversacional").
- **G-4 (UX)** Make the found-results count more prominent.
- **G-5 (UX)** "Maximize" control that opens the chat panel in a larger layout.
- **G-6 (UX)** More compact applied-filter chips (kept, not removed — they give
  transparency + control).
- **G-7 (UX)** State-aware input placeholder: initial / has-results (how to
  refine) / no-results (how to loosen criteria).
- **G-8 (bug)** Confirm & resolve the "cards drop from 2 columns to 1 on
  re-search" report.
- **G-9 (feature)** Geo "nearby destinations": conversational follow-ups that
  expand the search to destinations near the current one.
- **G-10 (coverage)** Verify natural-language amenities/features resolution
  (pets, smoking, air conditioning, river/beach-front).
- **G-11 (feature)** Destination **attractions** usable from the chat ("ciudad
  con carnavales").
- **G-12 (moved out)** Points of interest with coordinates ("cerca del autódromo")
  → **moved to its own spec, HOS-113** (out of scope here; see §4/§11).

## 4. Non-goals

- **NG-1** Availability/date filtering (checkIn/checkOut stay cosmetic until the
  in-portal booking feature exists — owner decision).
- **NG-2** Re-architecting the two-phase intent→SSE→client-fetch flow; this spec
  extends it, not replaces it.
- **NG-3** PostGIS migration; keep the existing raw-SQL Haversine approach.
- **NG-4** Points of interest (POI) with coordinates — **tracked separately in
  HOS-113** (net-new table + migration + seed; depends on the shared Haversine
  helper this spec extracts). Not delivered here.

## 5. Current baseline

**Panel (web)** — `apps/web/src/components/ai-search/`:

- `AiSearchEntry.client.tsx` (drawer wrapper) → `SearchChatPanel.client.tsx`
  (thread + results grid) backed by `useSearchChat.ts`. Styles in
  `SearchChatPanel.module.css`. Mounted on `apps/web/src/pages/[lang]/alojamientos/index.astro`.
- Result grid rule (`.resultsGrid`): `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`.
  Empty-state is a full-width centered `<p>` (`.resultsEmpty`).
- The panel has two headers today ("Búsqueda inteligente" dialog title +
  "Búsqueda conversacional" region heading).

**Geo** — coordinates already exist on both entities as nested JSONB:

- `destinations.location.coordinates {lat, long}` (`destination.dbschema.ts:63`;
  `CoordinatesSchema`, `packages/schemas/src/common/location.schema.ts:38-54`).
- `accommodations.location.coordinates {lat, long}` (`accommodation.dbschema.ts:69`).
- **Both are `{lat: string, long: string}` (strings, key is `long` not `lng`),
  and both are optional/nullable** — any geo query needs a `coordinates IS NOT NULL`
  guard and a numeric cast.
- Existing Haversine: `buildGeoRadiusClause` (`accommodation.model.ts:350-365`,
  Earth radius 6371, `radiusKm` in km, raw SQL) + `buildDistanceOrderExpr`
  (`:113-125`) for `ORDER BY distance`. **Both are private/non-exported and
  duplicate the formula** — no reusable helper.

**Attractions** — full entity, NOT wired to accommodation search:

- `attractions` table (`attraction.dbschema.ts`) + `r_destination_attraction`
  join (destination↔attraction, many-to-many). No coordinates on attractions.
- Public API exists (`apps/api/src/routes/attraction/public/*`) with
  `destinationId` filter.
- **No accommodation↔attraction relation and no `attraction` filter in the
  accommodation search** (`accommodation.query.schema.ts` has no such field).

**River/beach-front** — already modeled as **features** in the catalog:
`Frente al río`, `Frente al balneario`, `Vista panorámica` (visible in the
accommodations filter panel). "Cerca de una playa / del río" resolves via these
existing features — no POI needed for the MVP.

**POI** — does not exist anywhere. Tracked as net-new work in HOS-113.

**Amenities/features** — search supports `amenities=[uuid]` (OR-within groups)
and `features=[uuid]` (AND intersection). Verified real slugs:

- Pets: `pet_friendly` (amenity), `pet_friendly_area` / `pet_suitable` (features).
- Smoking: `smoke_free` (amenity), `smoking_area` (feature) — **inverse framing,
  no literal `smoking` slug**.
- A/C: `air_conditioning` (amenity).

## 6. Proposed design

Organized into phases by risk. Phase 1 is frontend-only/low-risk; 2-3 add
backend/DB capability.

### Phase 1 — Panel UX + bug confirmation (G-1..G-8, G-10)

- **Cards** (G-1): redesign `ResultCard` to a compact layout — photo with
  overlaid badges (single star rating + type), reduced height.
- **Results container** (G-2): subtle themed background token to separate it
  from the chat thread (reuse existing surface tokens; web is vanilla CSS/CSS
  Modules).
- **Header** (G-3): collapse the dialog title + region heading into one header
  row; keep a11y labels.
- **Count** (G-4): prominent results-count treatment.
- **Maximize** (G-5) — **DECIDED (OQ-1)**: a toggle that widens the drawer to
  ~60% of the viewport (not a full-screen modal), reversible, keeping the page
  visible behind it. Enough room for 2-3 card columns.
- **Chips** (G-6): compact chip styling; consider a "N filtros" collapse when
  many. Also fix the intent-vs-params mismatch (chips currently render the raw
  LLM intent, e.g. a `maxGuests` chip that the params no longer send).
- **Placeholder** (G-7) — **DECIDED (OQ-5)**, state-aware copy:
  - initial: `"Contame qué buscás, por ejemplo: cabaña para 4 con pileta cerca del río"`
  - has-results: `"Afiná tu búsqueda: sumá precio, características, o pedí destinos cercanos"`
  - no-results: `"No encontré nada con esos filtros. Probá quitando alguno o buscá en destinos cercanos."`
- **Bug #8** (G-8): reproduce and confirm. Preliminary diagnosis: **not a CSS
  regression** — `.resultsGrid` is byte-identical in the base fix; the likely
  cause is the newly-reachable empty-state (`.resultsEmpty`, full-width `<p>`)
  showing when a chat *refinement* returns 0 results (looks like "1 full-width
  column"). Confirm with the results count in repro. If count > 1 and it's still
  1 column, the cause is an ancestor layout container, not the intent fix.
- **Amenities/features verification** (G-10): confirm the allowlist + prompt map
  pets/smoking/AC/river-beach-front natural language to the real slugs above; add
  the missing ones (smoking is inverse — "que se pueda fumar" → `smoking_area`
  feature; "libre de humo" → `smoke_free`; "cerca de la playa/río" → the
  `Frente al balneario`/`Frente al río` features).

### Phase 2 — Geo "nearby destinations" (G-9)

- **Shared Haversine helper**: extract `buildHaversineDistanceExpr({latCol, longCol, lat, long})`
  (and a `withinRadius` variant) from the private functions in
  `accommodation.model.ts` into a reusable place, so destination↔destination and
  destination↔accommodation distance share one formula. (This helper is also the
  dependency HOS-113/POI builds on.)
- **Nearby-destination resolution** — **DECIDED (OQ-2)**: given the current
  destination (from the prior turn's `destinationId`), find destinations with
  coordinates within a **fixed radius of ~50 km** (tunable via a constant, no UI),
  guarded by `coordinates IS NOT NULL`, with a **fallback to the N nearest
  destinations** if the radius returns none — so a follow-up never comes back empty.
  50 km from Colón covers Pueblo Liebig, San José and Concepción del Uruguay
  (the owner's example).
- **Conversational intent**: the endpoint already sends message history. Reinforce
  the extraction prompt so follow-ups like "y en destinos cercanos" /
  "también cerca" produce an intent signal (e.g. a new `expandToNearby: boolean`
  or `nearbyOfDestinationId`) that the handler turns into a multi-destination or
  geo-radius search around the anchor destination's coordinates.
- Emit the resolved set of destinations back in the `filters` SSE frame so the UI
  can show which destinations were included.

### Phase 3 — Attractions from chat (G-11)

- **MVP**: resolve an attraction mentioned in NL (e.g. "carnavales") to
  attraction(s) via the existing catalog, find the destinations that have that
  attraction (`r_destination_attraction`), and constrain the accommodation search
  to those destinations. No accommodation↔attraction join required for the MVP.
- Inject a curated attraction allowlist into the prompt (same pattern as
  amenities/features) so the model emits canonical attraction slugs.
- Note (OQ-3 resolved): beach/river proximity is handled via existing **features**
  (§5), not attractions and not POI. Precise-coordinate landmarks ("el autódromo")
  are out of scope → HOS-113.

## 7. Data model / contracts

- **No schema change** for any phase here (geo + attractions reuse existing
  columns and the `r_destination_attraction` join). POI's new table lives in HOS-113.
- **Intent schema** (`packages/schemas/.../ai-search-intent.schema.ts`): likely a
  new optional slot for nearby/geo expansion (Phase 2) and possibly an
  `attractionSlugs` slot (Phase 3), mirroring `amenitySlugs`/`featureSlugs`.
- **Accommodation query** (`accommodation.query.schema.ts`): Phase 3 may add a
  multi-`destinationId` filter if not already supported; Phase 2 can reuse the
  existing `latitude`/`longitude`/`radius` params.

## 8. UX / UI behavior

- One header; results area visually distinct (subtle background); compact cards
  with overlaid star + type badges; prominent count; maximize toggle (~60%
  viewport, reversible); compact chips; state-aware placeholder (copy in §6).
- Nearby-destinations result set should make it clear which destinations were
  searched (chips or a line like "incluyendo Pueblo Liebig, San José, C. del Uruguay").
- Empty-state and results-grid must be visually distinct so a 0-result refinement
  never reads as "the grid broke".

## 9. Acceptance criteria

- **AC-1** Result cards render compact with star + type as badges over the photo;
  vertical height measurably reduced vs current.
- **AC-2** Results area has a distinct background from the chat thread.
- **AC-3** Panel shows a single header.
- **AC-4** Results count is visually prominent.
- **AC-5** A maximize control widens the panel to ~60% viewport and can be reverted.
- **AC-6** Filter chips are compact and reflect the **applied params** (no chip
  for a filter that isn't actually sent).
- **AC-7** Placeholder text changes across initial / has-results / no-results,
  using the copy in §6.
- **AC-8** Bug #8 reproduced and either fixed or documented as the empty-state
  behavior with the agreed UX.
- **AC-9** "cabaña en Colón, y también en destinos cercanos" returns
  accommodations from Colón plus destinations within ~50 km (e.g. Pueblo Liebig,
  San José, Concepción del Uruguay), with the included destinations shown; if the
  radius is empty it falls back to the N nearest.
- **AC-10** NL queries for pets / smoking / air conditioning / river-beach-front
  map to the correct real slugs and return the expected filtered results.
- **AC-11** An attraction-based query ("una ciudad con carnavales") constrains
  results to destinations that have that attraction.
- **AC-12** Tests for every new logic unit (intent mapping, geo helper, attraction
  resolution) + regression tests; typecheck/lint/tests green.

## 10. Risks

- **R-1** Coordinates are optional on both destinations and accommodations — geo
  features silently under-return for rows lacking coordinates. Needs explicit
  `IS NOT NULL` handling and possibly a seed-data audit.
- **R-2** Haversine is raw SQL with no spatial index — nearby queries over many
  rows may be slow; acceptable at current data volume but worth noting.
- **R-3** Conversational context (nearby/refine) depends on the LLM correctly
  using message history; probabilistic — needs deterministic guards where
  possible and good prompt design.
- **R-4** Attraction NL matching ("carnavales") is fuzzy; a curated allowlist
  mitigates hallucination but needs maintenance.
- **R-5** Scope creep — this spec is intentionally broad; phases must be
  independently shippable so partial delivery is possible.

## 11. Open questions

All initial open questions were resolved with the owner (2026-07-09):

- **OQ-1 (Maximize)** → RESOLVED: widen the drawer to ~60% viewport, reversible;
  not a full-screen modal.
- **OQ-2 (Nearby definition)** → RESOLVED: fixed radius ~50 km via constant, with
  a fallback to the N nearest destinations when the radius is empty. No UI config.
- **OQ-3 (beach/river proximity)** → RESOLVED: handled via existing `features`
  (`Frente al río` / `Frente al balneario`), not attractions, not POI.
- **OQ-4 (POI)** → RESOLVED: out of scope; moved to its own spec **HOS-113**
  (new `points_of_interest` table, for both accommodation search and destination
  detail pages).
- **OQ-5 (placeholder copy)** → RESOLVED: copy defined in §6 (regional
  Rioplatense phrasing; dropped "aflojar un filtro").

New questions may still arise once the base fix is merged and the panel gets more
use — this spec stays open to additions.

## 12. Implementation notes

- Web is vanilla CSS / CSS Modules (no Tailwind). Reuse existing surface/overlay
  design tokens for the results-area background and maximize layout.
- The `aiSearch.*` i18n namespace has **no** entries in `packages/i18n` — the
  whole panel relies on inline `t(key, fallback)` fallbacks. Keep that pattern.
- Chips currently render from the raw LLM `intent` (which may include e.g.
  `maxGuests`) rather than the applied `params`; G-6/AC-6 should switch chips to
  reflect applied params so they never show a filter that isn't sent.
- Extract the Haversine helper rather than duplicating it a third time; keep the
  filter clause and the `distance` sort expression consistent (they already
  mirror each other). HOS-113 (POI) depends on this helper.
- Amenities/features: smoking is modeled inversely (`smoke_free` / `smoking_area`)
  — the allowlist and prompt must handle "se puede fumar" vs "libre de humo".
- Base fix context (separate PR): city→destinationId resolution
  (`resolveDestinationIdFromCity` in `search-chat.ts`), min-only guests/bedrooms/
  bathrooms, boolean-shortcut dedup, `pet_friendly` slug fix, `maxRating` no-op,
  chat markdown, reachable empty-state.

## 13. Linear

Canonical tracking:
HOS-111

Related:
HOS-113 (Points of interest — follow-up feature)

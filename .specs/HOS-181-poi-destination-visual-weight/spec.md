---
title: POI destination page — reduce visual weight (list + map)
linear: HOS-181
statusSource: linear
created: 2026-07-16
type: feature
areas:
  - web
---

# POI destination page — reduce visual weight (list + map)

## 1. Summary

Points of interest (POIs) matter on the destination detail page, but they ended
up with too much visual weight on both surfaces that render them: the SSR
list/grid (`DestinationPOISection.astro`) and the client-only map
(`DestinationPOIMap.client.tsx`). This spec reduces that weight by (a) showing
only the most important POIs by default in the grid with a visual-only "show
more" disclosure for the rest, (b) making each POI card smaller, and (c) loading
fewer map pins by default. The existing importance order (featured →
`displayWeight` desc → alphabetical) already defines "most important" — what is
missing is the cut-off and the disclosure.

## 2. Problem

The destination detail page renders POIs on two stacked surfaces (grid first,
then map). Both currently show **everything**, with no cap:

- **Grid** (`DestinationPOISection.astro`): renders **every** PRIMARY POI, no
  count limit — just a `relation !== 'NEARBY'` filter. Concepción del Uruguay
  shows **71** cards, Colón **41**. Each card is fairly heavy (icon + name +
  type badge + a 2-line-clamped description, `padding: 1.25rem`, ~140-180px
  tall, 4-column grid on desktop), so a long uncapped list dominates the page.
- **Map** (`DestinationPOIMap.client.tsx`): loads all PRIMARY pins from the SSR
  payload **plus** all NEARBY pins fetched client-side on mount (Colón: 41
  PRIMARY + 56 NEARBY = 97 pins). The NEARBY fetch happens **eagerly and
  unconditionally on every mount**, even if the visitor never asks to see the
  surroundings.

Part of the weight is a **data** problem, not UI (see §11 / HOS-177): the
HOS-141 geocoder assigned some POIs to the wrong destination at up to ~39km as
PRIMARY, so a few of CdU's 71 are probably not really CdU POIs. Curating that
data (HOS-177 tightened the geocode guards; reducing PRIMARY-per-destination is
a separate owner curation decision) reduces the problem at the root and may
change how much UI cut-off is actually needed. This spec is the UI half; it is
designed to be correct regardless of how much curation lands.

## 3. Goals

- G-1 Grid shows only the top-N most important PRIMARY POIs by default, with a
  disclosure to reveal the rest.
- G-2 The disclosure is **visual only** — the full set of PRIMARY POIs stays in
  the SSR HTML so it remains crawlable (SSR-first, per `apps/web/CLAUDE.md`).
- G-3 Each POI card is visually smaller/lighter than today.
- G-4 The map loads fewer pins by default, with an existing/extended control to
  load more.
- G-5 No regression to the indexable content of the destination page (the grid
  keeps rendering the full PRIMARY set in HTML).

## 4. Non-goals

- NG-1 POI category icons and per-category marker color — explicitly out of
  scope, blocked by HOS-139 (M2M category model).
- NG-2 Data curation (reducing PRIMARY count per destination, fixing wrong-city
  assignments) — that is HOS-177 and a separate owner decision. This spec does
  not re-run the pipeline or edit fixtures.
- NG-3 Adding pagination / a `limit` param to the public POI endpoint — the
  endpoint is deliberately non-paginated (worst case ~99 rows) to avoid the
  HOS-135 truncation bug. The grid cut-off is a client-side render concern, not
  an API change.
- NG-4 Changing the PRIMARY/NEARBY relation data or the importance sort formula.

## 5. Current baseline

Verified against the code (file:line references):

### Grid — `apps/web/src/components/destination/DestinationPOISection.astro`

- Props (L78-81): `{ pointsOfInterest: ReadonlyArray<DestinationPOIItem>, locale }`.
  `DestinationPOIItem` carries `isFeatured?, displayWeight?, relation?`, etc.
- Filter (L90): `pointsOfInterest.filter(poi => poi.relation !== 'NEARBY')` —
  renders **all** PRIMARY, no cap.
- Sort **lives in this component's frontmatter** (L94-110), pure SSR JS:
  `featured (0/1) → displayWeight desc → displayName.localeCompare`. Not in the
  API payload or any service. Changing truncation/cut-off touches only this file.
- Pure SSR `.astro`, **no `client:*` directive** — zero hydration.
- Card (L136-148, styles L185-233): `.poi-section__card`, flex column, 28px
  icon + `<h3>` + type-name pill + optional 2-line-clamped description,
  `padding: 1.25rem`. Grid `repeat(4,1fr)` ≥1024px, 2 cols ≥640px, 1 col mobile.

### Map — `DestinationPOIMap.client.tsx` (+ `MultiMarkerMapInner.client.tsx`)

- PRIMARY pins arrive via the `pointsOfInterest` prop (same array the grid gets).
- NEARBY pins: `useNearbyPointsOfInterest` (L98-137) — `useEffect` fires on mount
  keyed only on `destinationId`, calls
  `destinationsApi.getPointsOfInterest({ id, relation: 'NEARBY' })` **eagerly,
  not behind any toggle**. Degrades silently to `[]` on failure.
- Directive: `client:only="react"` (page L625) — **emits zero SSR HTML**.
- "Ver alrededores" toggle already exists: `computeSurroundingsBounds` (from
  `@/lib/poi-map-bounds`), capped around the destination centre (~50km; the
  numeric constant lives in `poi-map-bounds.ts`, cited because uncapped bbox
  reaches 256km on ceibas / 214km on san-justo). The toggle only *appears* when
  `primaryMarkers.length < markers.length` (i.e. after NEARBY resolves with
  extras). Labels: `maps.showSurroundings` / `maps.hideSurroundings`.
- Pins already visually tiered: PRIMARY = 34px solid filled + 16px glyph;
  NEARBY = 24px outlined + 12px glyph (`MultiMarkerMapInner` `getPoiDivIcon`).

### Destination page — `apps/web/src/pages/[lang]/destinos/[...path].astro`

- Grid at L609, map at L622-632, stacked vertically in that order. Map wrapper
  rendered only when `hasGeolocatedPois` (L152), with reserved height
  (560/480/400px) to avoid CLS from the `client:only` island.
- PRIMARY payload comes from the destination-detail SSR fetch
  (`dest.pointsOfInterest`, hydrated by `DestinationService._withPointsOfInterest`,
  transformed via `toDestinationPointOfInterestListProps`) — not a separate call.

### Public endpoint — `apps/api/src/routes/destination/public/getPointsOfInterest.ts`

- `GET /api/v1/public/destinations/{id}/points-of-interest`, query param
  `relation` only (`PRIMARY|NEARBY|ALL`, default `ALL`). **No `limit`/pagination.**
- Non-paginated by design (`DestinationService.getPointsOfInterest`, service
  L719-762) to avoid HOS-135 truncation. `cacheTTL: 300`,
  rate-limit 100/60s.

### Reusable i18n vocabulary (already in the web app)

- `common.readMore` → "Ver más" (accommodation/experience/gastronomy cards).
- `destination.detailPage.viewAll` → "Ver todos" (other sections on this same page).
- `destinations.filter.showMore` → "Ver más" — a `<details>/<summary>` chip-overflow
  disclosure on `/destinos/index.astro:305`, the **closest structural analog** to
  an expand-the-POI-grid control.
- `maps.showSurroundings` / `maps.hideSurroundings` for the map toggle.

## 6. Proposed design

Two surfaces, two different mechanisms, because their SEO constraints differ.

### 6.1 Grid — visual-only truncation (SSR-safe)

Render **all** PRIMARY POIs into the HTML exactly as today (crawlable), but hide
the tail past the cut-off with a **CSS/`<details>`-driven disclosure** so the
DOM still contains every card:

- Keep the existing filter + sort untouched. After sorting, split into
  `head = sorted.slice(0, N)` and `tail = sorted.slice(N)`.
- Render `head` normally; render `tail` inside a collapsible region that ships
  in the HTML but is visually hidden until expanded. Prefer the native
  `<details>/<summary>` pattern already used by `destinations.filter.showMore`
  (works without JS, keyboard-accessible, no hydration — consistent with the
  grid's zero-`client:*` nature). The `<summary>` is the "Ver más (X)" / "Ver
  todos" control; reuse `common.readMore` or `destination.detailPage.viewAll`
  rather than a new key.
- If `tail` is empty (destinations with ≤ N PRIMARY), render no disclosure at all.
- `N` is a named constant in the component. **Decided: N = 12** (three full
  4-column desktop rows) — see §11 D-1.

This is the SSR-first choice: the full PRIMARY set stays in `<html>`, so no POI
content leaves crawler reach (G-2, G-5). Rejected alternative: server-side
"render only N" — it would drop the tail from the HTML and lose that indexable
content, which the issue explicitly warns against.

### 6.2 Grid — smaller cards (G-3)

Reduce per-card height/weight via the component's CSS module. **Decided (§11
D-3): reduce `padding` (1.25rem → ~0.85rem) and tighten the description clamp
from 2 lines to 1.** Keep the description (do not drop it to a bare chip) so the
card retains context. Raising desktop grid density is optional/secondary.

### 6.3 Map — load fewer pins by default (G-4)

The map emits no SSR HTML, so cuts here are pure client concerns with no SEO risk.

- **The lever — make the NEARBY fetch lazy (Decided, §11 D-2).** Today it fires
  eagerly on mount. Change `useNearbyPointsOfInterest` to fetch **only when the
  visitor activates "ver alrededores"**, so a default page view ships only
  PRIMARY pins and saves a client round-trip. The "ver alrededores" control
  becomes the trigger for both the fetch and the reveal. Caveat: HOS-146
  deliberately made this eager; changing it is a considered reversal, and the
  toggle's appearance gate (`primaryMarkers.length < markers.length`) must be
  reworked since that count is only known post-fetch (e.g. show the control
  whenever the destination *could* have NEARBY, or always show it and let it
  no-op to empty).
- **PRIMARY pins are NOT capped (Decided, §11 D-4).** With NEARBY lazy, the
  default map already shows only PRIMARY, which is manageable. Do not add
  top-N/expand logic to PRIMARY markers unless real usage shows the PRIMARY set
  is still too dense — that stays a possible future follow-up, not this spec.

## 7. Data model / contracts

No schema, migration, or endpoint changes. The public POI endpoint stays as-is
(NG-3). All work is in `apps/web` components + CSS + i18n. Sort and truncation
stay client/SSR-frontmatter compute. No new env vars.

Possible new i18n keys (only if an existing one doesn't fit): a count-bearing
"Ver más (X)" label; otherwise reuse `common.readMore` /
`destination.detailPage.viewAll`. New keys must land in all three locales
(es/en/pt) per the i18n rules.

## 8. UX / UI behavior

- **Default view**: grid shows the top-12 (D-1) most important POIs as smaller
  cards. If there are more, a "Ver más (X)" / "Ver todos" disclosure sits below
  the head; expanding it reveals the rest in place. Collapsing restores.
- **No-JS / crawler**: all PRIMARY POIs are present in the HTML; with `<details>`
  the tail is reachable by expanding the native control even without JS.
- **Map default**: only PRIMARY pins visible; "Ver alrededores" both loads and
  shows NEARBY pins (D-2). "Volver a la ciudad" hides them.
- Keyboard + screen-reader: the disclosure control is a real
  `<summary>`/`<button>` with an accessible name and expanded state; POI cards
  keep their current semantics.

## 9. Acceptance criteria

- AC-1 On a destination with more than 12 PRIMARY POIs, the grid renders only 12
  cards visible by default, with a working "show more" control that reveals the
  rest.
- AC-2 View-source / SSR HTML of that page contains **all** PRIMARY POI cards
  (not just 12) — verified by asserting the hidden tail exists in the served HTML.
- AC-3 On a destination with ≤ 12 PRIMARY POIs, no disclosure control renders.
- AC-4 Each POI card is measurably smaller than baseline (reduced padding +
  1-line description) and the grid visually occupies less vertical space.
- AC-5 On page load, the map shows only PRIMARY pins and performs **no** NEARBY
  network request until the visitor activates "ver alrededores" (D-2).
- AC-6 Activating "ver alrededores" loads and displays NEARBY pins; deactivating
  hides them; failure degrades silently (no broken map), preserving HOS-146's
  contract.
- AC-7 i18n: all new/used labels resolve in es/en/pt; no missing-key fallbacks.
- AC-8 No CLS regression on the map wrapper (reserved height preserved).

## 10. Risks

- R-1 Making the NEARBY fetch lazy (D-2) reverses a deliberate HOS-146 decision
  and reworks the toggle's post-fetch appearance gate. Mitigated by careful
  handling of the "control visible before we know if NEARBY exists" case (show
  the control whenever the destination could have NEARBY, or always show it and
  let it no-op to empty).
- R-2 A `<details>`-based tail must not double-count or reorder cards vs the head;
  the split must be a clean `slice`, and CSS grid flow across the boundary needs
  checking (the tail may need to live in the same grid container to avoid a
  visual seam).
- R-3 The right N depends on data curation (HOS-177). Choosing N too low hides
  legitimately important POIs; too high defeats the purpose. Mitigated by making
  N a single constant, easy to tune.
- R-4 Compacting cards must keep them accessible (tap target size, contrast,
  truncation not clipping meaning).

## 11. Decisions (resolved with owner, 2026-07-16)

All five open questions were resolved before versioning this spec:

- D-1 **Grid cut-off N = 12** (three full desktop rows). CdU goes from 71 to 12
  visible + "ver más (59)". Not per-breakpoint.
- D-2 **Map NEARBY fetch is lazy** — fetched only when the visitor activates
  "ver alrededores". Deliberate reversal of HOS-146's eager-on-mount; the toggle
  appearance gate is reworked accordingly (see §6.3).
- D-3 **Card compaction: reduce padding (1.25rem → ~0.85rem) + description clamp
  2 lines → 1 line.** Keep the description; do not reduce to a bare chip.
- D-4 **Do NOT cap PRIMARY pins on the map.** Lazy NEARBY makes the default map
  (PRIMARY-only) manageable; a PRIMARY top-N/expand is out of scope, a possible
  future follow-up only if real usage shows PRIMARY density is still a problem.
- D-5 **Sequence: build this UI now; data curation is a separate track.** HOS-177
  (wrong-city PRIMARY assignments, reducing PRIMARY-per-destination) proceeds on
  its own / as an owner curation decision and only tunes how visible the cut-off
  is. This spec is written to be correct regardless of how much curation lands.

## 12. Implementation notes

- Everything is in `apps/web`; the single highest-leverage file is
  `DestinationPOISection.astro` (filter/sort/split + card CSS). No service, API,
  schema, or DB changes.
- The sort is already in the component frontmatter — do the head/tail split right
  after the existing `.sort()`, don't move sorting anywhere.
- Reuse the `<details>/<summary>` disclosure pattern from
  `/destinos/index.astro:305` (`destinations.filter.showMore`) for consistency
  and zero-hydration behavior.
- Map changes touch `DestinationPOIMap.client.tsx` (`useNearbyPointsOfInterest`
  - the toggle gate) and possibly `poi-map-bounds.ts` if the surroundings radius
  needs revisiting (it likely does not).
- Keep the map wrapper's reserved height (CLS guard) intact.
- Tests: web component/DOM assertions for AC-1/AC-2/AC-3 (assert the hidden tail
  is in the rendered HTML — this is exactly the SSR-first guarantee), and a
  network assertion for AC-5 (no NEARBY request on default load).

## 13. Linear

Canonical tracking:
HOS-181

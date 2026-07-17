---
title: Thematic POI Filters by Category
linear: HOS-147
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - web
  - api
---

# Thematic POI Filters by Category

## 1. Summary

Let users filter points of interest by theme/category (e.g. "beaches", "thermal baths", "museums"), backed by the M2M POI-category model, surfaced as a multi-select filter-chip UI on the destination detail page. Filtering happens **client-side over the already-loaded POI list** (the destination POI endpoint returns the full, unpaginated set); the API contributions are a new public category-catalog endpoint (to render the chips) and exposing each POI's full category set in the existing payload (so the client can filter by any category, not just the primary one).

## 2. Problem

With ~914 POIs across 22 destinations (up from 12), a flat list is no longer browsable. Users need to narrow POIs down by theme to find what they're actually looking for.

## 3. Goals

- G-1: Add a **public POI-category catalog endpoint** so web can render the chip options (id, slug, nameI18n, icon, displayWeight), scoped to ACTIVE/non-deleted, sorted by `displayWeight`.
- G-2: **Expose the full category set per POI** in the destination-POI payload (currently only `primaryCategory` is returned), so client-side filtering can match against any of a POI's categories.
- G-3: Build a **multi-select filter-chip UI** on the destination detail page, reusing the existing HOS-96 chip pattern, that filters the loaded POI list and map **client-side** with **OR / any-of** semantics.
- G-4: Reflect the active selection in the URL (`?categories=<csv>`) for shareability/deep-linking, without a server round-trip for the list.

## 4. Non-goals

- NG-1: No server-side query-param filtering on the destination POI endpoint (superseded by the client-side decision — D-1). The endpoint keeps returning the full set.
- NG-2: No free-text search combined with category filters in this spec.
- NG-3: No admin-side category management here (that's HOS-139/HOS-144).
- NG-4: No SEO dedicated-landing-per-category canonical (the destination page stays canonical; filtering is a client-side view refinement, not a distinct indexable URL). May be revisited separately.

## 5. Current baseline

(Verified against the codebase, 2026-07-16.)

- **POI category model (HOS-139) is fully landed**: `poi_categories` catalog (`id, slug` unique, `nameI18n` jsonb, `icon`, `displayWeight` default 50, `lifecycleState`) + `r_poi_category` M2M join (`pointOfInterestId, categoryId, isPrimary`; composite PK; partial-unique index enforcing at most one `isPrimary=true` per POI). Migrations `0053`/`0054`. Zod schemas + Drizzle models present.
- **Single-value category filtering already works on the general POI search path** (`PointOfInterestService.resolveCategoryIdFilter` → joins through `r_poi_category`, matching ANY of a POI's categories, not just primary). Multi-value would come "for free" mechanically (`RPoiCategoryModel.findAll({ categoryId: [...] })` → SQL `IN (...)` via `buildWhereClause`) — but this path is NOT what the destination detail page uses.
- **The destination detail page uses a separate path**: `GET /api/v1/public/destinations/{id}/points-of-interest?relation=` → `DestinationService.getPointsOfInterest` → `DestinationModel.getPointsOfInterestMap` (`packages/db/src/models/destination/destination.model.ts`), a hand-written JOIN that already LEFT JOINs `r_poi_category`/`poi_categories` to attach `primaryCategory` (HOS-182) but has no category filter and returns the **full unpaginated set** (no pagination). Response schema: `DestinationPointOfInterestSummarySchema`.
- **No public category-catalog endpoint exists** — `apps/api/src/routes/poi-category/` is admin-tier only.
- **Web POI rendering lives only on the destination detail page** — `apps/web/src/components/destination/DestinationPOISection.astro` (SSR cards, no filter UI) and `DestinationPOIMap.client.tsx` (Leaflet island; renders PRIMARY POIs from the SSR prop + NEARBY fetched client-side). Both are wired from `apps/web/src/pages/[lang]/destinos/[...path].astro`, sharing one `pointsOfInterest` list built once. There is no dedicated POI listing page.
- **HOS-96 chip pattern** (`apps/web/src/lib/filters/`: `facet-config.ts`, `read-facet-active-values.ts`, `toggle-multi-query-param.ts`, `build-clear-facet-chip.ts`; rendered by `FilterChips.astro`) is generic and reusable. a11y convention is **`aria-current` on the `<a>`, never `aria-pressed`** (CI-enforced).

## 6. Proposed design

### Resolved decisions

- **D-1 (OQ-1 semantics)**: multi-category selection uses **OR / any-of** — a POI matches if it belongs to **any** selected category. (Same-facet multi-select convention; matches HOS-96.)
- **D-2 (OQ-2 location)**: the filter lives on the **destination detail page** only. No dedicated POI listing page exists.
- **D-3 (where filtering happens)**: **client-side over the already-loaded list**. The destination POI endpoint returns the full unpaginated set, so the client filters `pointsOfInterest[]` (cards + map) in memory. URL reflects the selection for shareability; the server does not re-filter the list. (Owner decision, 2026-07-16.)
- **D-4 (match scope)**: filter against **all** of a POI's categories via `r_poi_category`, not only `primaryCategory`. This requires exposing the full category set per POI in the payload (G-2) — `primaryCategory` stays for badge/icon display.

### API

1. **Public category-catalog endpoint** — `GET /api/v1/public/poi-categories` (new `public/list.ts` under `apps/api/src/routes/poi-category/`, `createPublicListRoute` or `createPublicRoute`). Returns ACTIVE, non-deleted categories `{ id, slug, nameI18n, icon, displayWeight }`, sorted by `displayWeight` asc then `slug`. `cacheTTL` in line with other public catalog routes. Backed by `PoiCategoryService` (add a `listPublic`/`searchActive` read method if not present).
2. **Expose full category set per POI** — extend `DestinationModel.getPointsOfInterestMap` to aggregate all `r_poi_category` rows per POI into `categories: { slug }[]` (e.g. `json_agg` / grouped fetch), and add `categories: z.array(...)` to `DestinationPointOfInterestSummarySchema`. `primaryCategory` is unchanged. No new query param on the endpoint.

### Web

3. **Chip UI island** — a client component (`DestinationPOIFilter.client.tsx` or equiv) that:
   - Fetches the category catalog (or receives it as an SSR prop from the page, preferred to avoid a client fetch) and renders chips following the `FilterChips.astro` shape (`<a>`-based, `aria-current`, icon/color via `getPoiCategoryIcon`/`getPoiCategoryColorScheme`).
   - Reads the initial `?categories=<csv>` from the URL on mount (reuse `readFacetActiveValues`).
   - On toggle: updates the active set, writes the URL via `history.pushState`/`replaceState` (reuse `buildMultiToggleParamHref` semantics: CSV param, drop `page`), and applies the filter.
   - Renders a "Clear (N)" chip when ≥2 active (reuse `buildClearFacetChip`).
4. **Coordinating list + map** — the SSR cards in `DestinationPOISection.astro` stay server-rendered (SEO: the full set is in the HTML). Each card carries a `data-poi-categories` attribute (the POI's category slugs). The chip island toggles card visibility by intersecting `data-poi-categories` with the active set (OR), and notifies the map via a `window` `CustomEvent` (e.g. `hospeda:poi-category-filter`, detail `{ categories: string[] }`); `DestinationPOIMap.client.tsx` listens and filters its markers (both the SSR-provided PRIMARY set and the client-fetched NEARBY set) with the same OR logic. No new shared-state library.
5. **Facet registration** — add a POI-category `FacetId` to `facet-config.ts` (`paramKey: 'categories'`, `operator: 'OR'`, `enum: undefined` — DB-driven, like `destinationAttraction`), so the read/toggle helpers work unchanged.

## 7. Data model / contracts

- No schema/migration changes to `poi_categories` / `r_poi_category` (HOS-139 already sufficient).
- `DestinationPointOfInterestSummarySchema` gains `categories: z.array(z.object({ slug: z.string() }))` (all categories of the POI). `primaryCategory` unchanged.
- New public response schema for the catalog: `PublicPoiCategorySchema` = `{ id, slug, nameI18n, icon (nullable), displayWeight }`.
- URL contract (web, client-only): `?categories=<slug>[,<slug>...]` (CSV; repeated-key `?categories=a&categories=b` also tolerated on read via `readFacetActiveValues`). `page` is dropped on toggle. Deep-links are honored on hydration (SSR renders unfiltered, island applies the filter after mount — accepted trade-off of D-3).

## 8. UX / UI behavior

- Chips render above the POI grid on the destination detail page, one chip per category **present among that destination's POIs** (D-5, computed client-side from the loaded set; not the full catalog), plus a "Clear (N)" chip when ≥2 active.
- Toggling a chip filters both the card grid and the map markers instantly, in sync, with no page reload and no network request.
- OR semantics: selecting "beaches" + "thermal baths" shows POIs in either.
- **Empty state**: if a selection matches zero POIs, show an explicit empty message (reuse the section's existing empty-state pattern) with the active chips still visible so the user can adjust/clear.
- a11y: chips are `<a>` with `aria-current="true"` when active (never `aria-pressed`); the filter region has an accessible label; toggling is keyboard-operable.
- Active chips reflect the URL on load (deep-link/refresh/share reproduce the same filtered view after hydration).

## 9. Acceptance criteria

- AC-1: `GET /api/v1/public/poi-categories` returns only ACTIVE, non-deleted categories, sorted by `displayWeight` then `slug`, each with `{ id, slug, nameI18n, icon, displayWeight }`. (BDD: Given active + soft-deleted categories, When I GET the endpoint, Then only active ones are returned in weight order.)
- AC-2: The destination POI payload includes `categories[]` (all of each POI's category slugs), in addition to `primaryCategory`. (Given a POI with categories [beach, gastronomy] primary=beach, When I fetch the destination POIs, Then its `categories` contains both slugs.)
- AC-3: Selecting one category chip filters both the card grid and the map to POIs belonging to that category (matching any category, not only primary). (Given a POI whose non-primary category is "gastronomy", When I select "gastronomy", Then that POI is shown.)
- AC-4: Selecting multiple chips applies OR semantics (union). (Given selections beach+museum, Then POIs in beach or museum are shown.)
- AC-5: The URL reflects the active selection as `?categories=<csv>` and dropping/adding chips updates it without a reload; loading that URL reproduces the filtered view after hydration.
- AC-6: A selection matching zero POIs shows the empty state with chips still adjustable.
- AC-7: Chips use `aria-current` (not `aria-pressed`), are keyboard-operable, and the a11y CI sweep passes.
- AC-8: The SSR HTML of the destination page still contains the full POI set (SEO regression guard).

## 10. Risks

- R-1: **Client-side filter data dependency** — filtering by all categories requires the payload to carry every POI's categories. Aggregating in `getPointsOfInterestMap` must not regress the HOS-135 pagination-truncation fix or the HOS-182 primary-category display. Mitigate with a query that GROUPs/aggregates cleanly and tests on a POI-rich destination (Colón).
- R-2: **List/map sync via CustomEvent** — the two islands hydrate independently; a filter applied before the map hydrates must be re-applied on the map's mount (map reads current URL/active set on init, not only via live events).
- R-3: **NEARBY markers fetched client-side** must apply the same filter as the SSR PRIMARY set (single filter function shared/duplicated consistently).
- R-4: **Deep-link flash** — SSR shows unfiltered until hydration; accepted per D-3, but keep hydration cheap so the flash is minimal.
- R-5: **Category catalog size / relevance** — showing every catalog category as a chip even when a destination has none of them is noise; see OQ-3.

## 11. Open questions

- OQ-1 (OR vs AND) — **RESOLVED → OR / any-of** (D-1).
- OQ-2 (where the filter lives) — **RESOLVED → destination detail page** (D-2); no dedicated POI listing exists.
- OQ-3 — **RESOLVED → present-only** (D-5, owner, 2026-07-16): the chip row shows only categories present among that destination's POIs (computed client-side from the loaded set), not the full catalog. Avoids dead chips that filter to zero. The public catalog endpoint (G-1) still provides label/icon/weight metadata for those present categories.

## 12. Implementation notes

- Reuse, don't reinvent: `readFacetActiveValues`, `buildMultiToggleParamHref`, `buildClearFacetChip`, `FilterChips.astro` shape, `getPoiCategoryIcon`/`getPoiCategoryColorScheme`.
- The destination page (`[...path].astro`) already builds `pointsOfInterest` once and shares it — thread the categories + the catalog prop from there.
- Prefer passing the category catalog as an SSR prop (fetched once server-side on the destination page) over a client fetch, to avoid an extra round-trip and keep chips available on first paint.
- Keep the OR filter predicate a single shared function used by cards, PRIMARY markers, and NEARBY markers.
- Tests: API — catalog endpoint (active/sort) + payload `categories[]` aggregation (service/model). Web — filter predicate (OR, multi-category, empty), URL read/write, a11y (`aria-current`). Follow project 90% coverage + AAA.

## 13. Linear

Canonical tracking:
HOS-147

Depends on: HOS-139 (POI categories model), HOS-142 (POI catalog import/seed). Both Done/merged to staging.

## Revision History

- 2026-07-16 (Phase 2 detailing): Filled design/contracts/AC/risks. Resolved OQ-1 (OR), OQ-2 (destination page). Owner decided client-side filtering over the already-loaded list (D-3) instead of a server-side endpoint query param — endpoint stays unfiltered; API work reduces to a public category-catalog endpoint + exposing full category set per POI. Added OQ-3 (all vs present-only chips).

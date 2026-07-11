---
title: Destination Map Layer with POIs
linear: HOS-146
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - web
---

# Destination Map Layer with POIs

## 1. Summary

Add a map layer on the destination page showing the destination's points of interest (POIs), visually distinguishing PRIMARY from NEARBY relations and using category-based icon markers.

## 2. Problem

The destination page currently lists content but has no spatial/visual view of what's around it. A map with POI markers helps tourists orient themselves and discover attractions, restaurants, and services near the destination.

## 3. Goals

- G-1: Render a map on the destination page with markers for all of that destination's POIs.
- G-2: Visually distinguish POIs whose `relation` to the destination is PRIMARY vs NEARBY (HOS-140's join column).
- G-3: Use category-based icons on markers (categories from HOS-139's `poi_categories` catalog).

## 4. Non-goals

- NG-1: Only POIs with coordinates are shown — no fallback rendering (e.g. list pin, geocoded placeholder) for coord-less POIs in this spec.
- NG-2: No routing/directions between POIs.
- NG-3: No clustering/performance optimization for very dense marker sets (deferred if it becomes an issue at implementation time).

## 5. Current baseline

The destination page currently renders `DestinationPOISection.astro` as a plain list (no map), built for the 12-POI HOS-113 baseline. The `r_destination_point_of_interest` join table is gaining a `relation` column (PRIMARY/NEARBY, default PRIMARY) under HOS-140's model changes. POI categories (with icons) live in the new `poi_categories` + `r_poi_category` M2M tables under HOS-139. Coordinates on `points_of_interest` are nullable (`lat`/`long`), since ~78% of the imported 914-POI dataset lacks them pending geocoding.

## 6. Proposed design

> TODO: detailed at implementation time (Phase 2).
- Likely a client-side map component (library choice TBD) fed by the destination's POI list with categories + relation already resolved server-side.

## 7. Data model / contracts

> TODO: detailed at implementation time (Phase 2).

## 8. UX / UI behavior

> TODO: detailed at implementation time (Phase 2).
- Legend/visual key for PRIMARY vs NEARBY and per-category icons.
- Empty state for destinations with zero coordinate-having POIs.

## 9. Acceptance criteria

> TODO: detailed at implementation time (Phase 2).

## 10. Risks

> TODO: detailed at implementation time (Phase 2).
- Given ~78% of the dataset lacks coordinates pre-geocoding, the map may look sparse for some destinations until HOS-142's data-enrichment pipeline improves coverage.

## 11. Open questions

- OQ-1: Which map library/provider to use (impacts bundle size, licensing, and whether it fits the web app's "minimize client JS" convention)?
- OQ-2: Should NEARBY POIs (belonging primarily to another destination) be shown at all, or only on request/toggle?

## 12. Implementation notes

> TODO: detailed at implementation time (Phase 2).

## 13. Linear

Canonical tracking:
HOS-146

Depends on: HOS-142 (POI catalog import/seed). Consumes model changes from HOS-139 (categories) and HOS-140 (destination-POI relation column).

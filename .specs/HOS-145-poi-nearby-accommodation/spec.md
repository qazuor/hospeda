---
title: "What's Nearby" POI Section on Accommodation Detail
linear: HOS-145
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - web
---

# "What's Nearby" POI Section on Accommodation Detail

## 1. Summary

Add a "What's nearby" section to the accommodation detail page on the web app, listing points of interest (POIs) within a radius of the accommodation's coordinates.

## 2. Problem

Tourists booking an accommodation want to know what's around it (beaches, restaurants, landmarks) before deciding. Hospeda already has proximity-search infrastructure server-side but no consumer-facing UI surfaces it on the accommodation page.

## 3. Goals

- G-1: Show a list of nearby POIs on the accommodation detail page, ordered by distance.
- G-2: Reuse the existing proximity-search capability rather than building new distance logic.
- G-3: Keep the feature low-cost — no new backend computation beyond what already exists.

## 4. Non-goals

- NG-1: No map visualization here (that's HOS-146, destination-level).
- NG-2: No thematic/category filtering of the nearby list (that's HOS-147).
- NG-3: No handling of POIs without coordinates — those are excluded entirely from this section.

## 5. Current baseline

Proximity search already exists server-side: the public POI endpoint accepts `poiId`/`poiSlug` params, defaults to a 5km radius, and computes distance via Haversine in `@repo/db` `packages/db/src/utils/geo.ts`. Web-side locale collapse for multilang POI name/description goes through `apps/web/src/lib/resolve-i18n-text.ts`. The accommodation detail page does not currently query or render POI proximity data. The POI catalog is being expanded from 12 curated POIs to ~914 under HOS-142; this feature is only meaningful once that import lands.

## 6. Proposed design

> TODO: detailed at implementation time (Phase 2).
- Likely reuses the existing proximity query, called from the accommodation's own `lat`/`long` instead of a POI's.
- Radius/count limits to be decided against real data density once HOS-142 lands.

## 7. Data model / contracts

> TODO: detailed at implementation time (Phase 2).

## 8. UX / UI behavior

> TODO: detailed at implementation time (Phase 2).
- Empty state needed for accommodations with no nearby POIs (or no coordinates themselves).

## 9. Acceptance criteria

> TODO: detailed at implementation time (Phase 2).

## 10. Risks

> TODO: detailed at implementation time (Phase 2).
- Accommodations without coordinates cannot use this section at all.

## 11. Open questions

- OQ-1: What radius and max POI count should the section use by default (5km matches proximity default, but accommodation context may want smaller)?
- OQ-2: Should POIs be grouped by category in the list, or is a flat distance-ordered list sufficient for v1?

## 12. Implementation notes

> TODO: detailed at implementation time (Phase 2).

## 13. Linear

Canonical tracking:
HOS-145

Depends on: HOS-142 (POI catalog import/seed of 914 POIs).

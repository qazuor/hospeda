---
title: AI-Assisted POI Itinerary
linear: HOS-149
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - web
  - api
---

# AI-Assisted POI Itinerary

## 1. Summary

Add an AI-assisted itinerary feature (e.g. "plan a day in Colón") that groups POIs by proximity, category, and priority, building on the existing AI-search infrastructure.

## 2. Problem

Tourists often want a curated plan, not just a list or map of POIs. With ~914 POIs across 22 destinations, there's enough density to generate a meaningful day-plan, but nothing today assembles POIs into a coherent itinerary.

## 3. Goals

- G-1: Generate an itinerary suggestion for a given destination (and possibly time window) grouping POIs sensibly by proximity/category/priority.
- G-2: Build on the existing AI-search infrastructure rather than a separate AI pipeline.
- G-3: Use the POI `keywords` field (already 100% populated in the dataset) to improve relevance.

## 4. Non-goals

- NG-1: No real-time routing/turn-by-turn directions.
- NG-2: No booking/reservation integration triggered from the itinerary in this spec.
- NG-3: No multi-day itinerary planning at launch — single-day scope only, per the plan's example.

## 5. Current baseline

Hospeda already has AI-search infrastructure (allowlist-driven) used elsewhere in the product. POI `priority` (HIGH/MEDIUM/LOW, mapping to `displayWeight`/`isFeatured`) and `keywords` (text array) are part of the HOS-142 model v2. Proximity computation (Haversine) already exists in `@repo/db` `utils/geo.ts`. Categories (HOS-139) provide the thematic grouping signal. No itinerary-assembly logic exists today.

## 6. Proposed design

> TODO: detailed at implementation time (Phase 3).
- Likely composes existing proximity + category + priority signals into a prompt/heuristic rather than a from-scratch recommendation engine.

## 7. Data model / contracts

> TODO: detailed at implementation time (Phase 3).

## 8. UX / UI behavior

> TODO: detailed at implementation time (Phase 3).
- Loading state needed given AI-generation latency.
- Fallback needed if the AI provider fails or returns nothing sensible.

## 9. Acceptance criteria

> TODO: detailed at implementation time (Phase 3).

## 10. Risks

> TODO: detailed at implementation time (Phase 3).
- Quality risk: AI-generated itineraries could recommend POIs lacking coordinates or unverified data, producing a nonsensical plan.

## 11. Open questions

- OQ-1: Does this reuse the same AI provider/model auto-detection work (HOS-94) as other AI features, or a fixed provider?
- OQ-2: Should itinerary generation be scoped to a destination, a POI, or a free-text prompt ("a day in Colón")?

## 12. Implementation notes

> TODO: detailed at implementation time (Phase 3).

## 13. Linear

Canonical tracking:
HOS-149

Depends on: HOS-142 (POI catalog import/seed).

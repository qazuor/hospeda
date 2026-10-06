---
title: POI-to-Listing Bridge
linear: HOS-150
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - api
  - content
---

# POI-to-Listing Bridge

## 1. Summary

Link points of interest in relevant categories (GASTRONOMY, WINERY, THERMAL_COMPLEX) to gastronomy and experience listings (SPEC-239), so a POI can point at an actual listed business.

## 2. Problem

The POI catalog and the gastronomy and experience listings (SPEC-239) are currently disconnected: a POI like a specific restaurant or winery has no link to that business's listing, if one exists. Bridging them lets tourists go from "discovering a place nearby" to "the business's real listing" without duplicate data entry.

## 3. Goals

- G-1: Allow a POI in a gastronomy and experience-relevant category to reference a linked gastronomy and experience entity (possibly via a `linkedEntityId`-style field).
- G-2: Respect gastronomy and experience domain isolation established by ADR-035/SPEC-239 (`product_domain` separation) — this bridge must not leak gastronomy and experience entitlement/subscription state into the accommodation domain or vice versa.
- G-3: Scope the link to the categories that plausibly map to gastronomy and experience listings (GASTRONOMY, WINERY, THERMAL_COMPLEX per the plan), not all POIs.

## 4. Non-goals

- NG-1: No automatic/bulk matching algorithm between POIs and gastronomy and experience entities in this spec — linking is assumed to start as a curated/manual step.
- NG-2: No changes to gastronomy and experience entitlement logic, plan gating, or `loadEntitlements()` filtering — this is a data link only.
- NG-3: No UI surface for the bridge beyond what's minimally needed to verify the link (full UX deferred).

## 5. Current baseline

Gastronomy and experience listings use billing domains isolated from `'accommodation'` (SPEC-239, ADR-035). Their plans are excluded from `ALL_PLANS`; the listing subscription relation associates a subscription with a listing through `entity_type` and `entity_id`. POI categories (GASTRONOMY, WINERY, THERMAL_COMPLEX, among ~40 total) are being modeled as a dedicated M2M catalog under HOS-139. No existing field connects a `points_of_interest` row to a listing.

## 6. Proposed design

> TODO: detailed at implementation time (Phase 3).

- Likely a nullable FK-style reference field on `points_of_interest` (or a small link table, mirroring the listing subscription relation) pointing at the relevant listing type/id.

## 7. Data model / contracts

> TODO: detailed at implementation time (Phase 3).

## 8. UX / UI behavior

> TODO: detailed at implementation time (Phase 3).

## 9. Acceptance criteria

> TODO: detailed at implementation time (Phase 3).

## 10. Risks

> TODO: detailed at implementation time (Phase 3).

- R-1: Any implementation that queries across the POI/gastronomy and experience boundary must not accidentally couple gastronomy and experience subscription state to accommodation entitlements (the exact bug class ADR-035/SPEC-239 was designed to prevent).

## 11. Open questions

- OQ-1: Is the link one-directional (POI → gastronomy and experience entity) or does the gastronomy and experience entity also need to reference back to the POI?
- OQ-2: What happens to the link if the gastronomy and experience listing is deleted/unsubscribed — does the POI silently lose its link, or does it need a dangling-reference cleanup step?

## 12. Implementation notes

> TODO: detailed at implementation time (Phase 3).

## 13. Linear

Canonical tracking:
HOS-150

Depends on: HOS-139 (POI categories model), HOS-142 (POI catalog import/seed). Related: SPEC-239 / ADR-035 (gastronomy and experience domain isolation).

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

Let users filter points of interest by theme/category (e.g. "beaches", "thermal baths", "museums"), backed by the M2M POI-category model, exposed as a query param on the public POI endpoint and a filter-chip UI on the web app.

## 2. Problem

With ~914 POIs across 22 destinations (up from 12), a flat list is no longer browsable. Users need to narrow POIs down by theme to find what they're actually looking for.

## 3. Goals

- G-1: Add a category filter query param to the public POI endpoint, backed by `r_poi_category`.
- G-2: Build a filter-chip UI on web reusing the existing multi-select chip pattern from HOS-96.
- G-3: Support multi-category selection (a POI can belong to more than one category).

## 4. Non-goals

- NG-1: No free-text search combined with category filters in this spec (may exist separately; not this feature's scope).
- NG-2: No admin-side category management here (that's part of HOS-139/HOS-144).

## 5. Current baseline

POI categories are moving to a dedicated `poi_categories` catalog table plus `r_poi_category` M2M join (with `isPrimary`) under HOS-139, replacing the old single `type` enum (9 values), which is being deprecated but kept temporarily for existing consumers. The public POI endpoint currently has no category filter. HOS-96 already established a chip-based multi-select filter UI pattern on web (`apps/web/src/lib/filters/`), including the a11y convention of `aria-current` on chip `<a>` elements rather than `aria-pressed`.

## 6. Proposed design

> TODO: detailed at implementation time (Phase 2).
- Query param shape (single category vs array) to mirror existing list-endpoint conventions.
- Chip UI to follow the HOS-96 pattern (page-to-API array forwarding via URL params).

## 7. Data model / contracts

> TODO: detailed at implementation time (Phase 2).

## 8. UX / UI behavior

> TODO: detailed at implementation time (Phase 2).
- Empty state for a category combination with zero matching POIs.

## 9. Acceptance criteria

> TODO: detailed at implementation time (Phase 2).

## 10. Risks

> TODO: detailed at implementation time (Phase 2).

## 11. Open questions

- OQ-1: Should filtering be by any-of (OR) or all-of (AND) semantics when multiple categories are selected?
- OQ-2: Where does this filter UI live — destination page, a dedicated POI listing page, or both?

## 12. Implementation notes

> TODO: detailed at implementation time (Phase 2).

## 13. Linear

Canonical tracking:
HOS-147

Depends on: HOS-139 (POI categories model), HOS-142 (POI catalog import/seed).

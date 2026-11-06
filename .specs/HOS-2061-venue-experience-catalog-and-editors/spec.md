---
title: Venue and experience catalog attributes, curation and amenity editor UX
linear: HOS-2061
statusSource: linear
created: 2026-11-05
type: feature
areas:
  - db
  - web
  - admin
  - content
smokeGates:
  - status-needs-smoke-staging
---

# Venue and experience catalog attributes, curation and amenity editor UX

Stage 5 of 5 of HOS-1016. **Phase B: blocked until HOS-1787 lands on `staging`,**
and until stage 2 (HOS-2058) is merged.

## 1. Summary

This stage brings venue and experience to parity with accommodation. It covers:

- the relation attributes;
- a curated, categorized catalog;
- a better amenity/feature editor for all three verticals: featured first, search,
  categories, attributes and a policies section;
- public filters grouped by category.

## 2. Problem

- `r_venue_amenity` and `r_experience_amenity` are bare pairs. A venue cannot mark
  an amenity as extra-cost, shared or seasonal.
- Venue has 20 amenities and 22 features; experience has 19 and 11. They were never
  curated against the D-1 rule. Cuisine and dietary items are uncategorized features.
- The editors have no search and no featured-first view, although `is_featured` and
  `display_weight` already exist on both tables and are unused by the editors.
- HOS-1787 task 6.10 (HOS-1870) computes per-collection filters from published
  listings and consumes this catalog.

## 3. Goals

- G-1 `scope`, cost (`is_optional`, `additional_cost`, `additional_cost_percent`)
  and `availability` on `r_venue_amenity` and `r_experience_amenity`, reusing the
  stage-2 enums.
- G-2 The venue and experience catalogs are curated under the admission rule, with
  categories (CUISINE and DIETARY for venue; AUDIENCE and LANGUAGE for experience).
- G-3 All three editors show featured items first, provide a search box, group
  features by category, and expose the attribute controls and the stage-4 policies
  section.
- G-4 Public filters are grouped by category and aligned with HOS-1870.

## 4. Non-goals

- NG-1 Per-dish dietary flags. That is the menu model (HOS-895), not the catalog.
- NG-2 Changing the night items added by HOS-1787 (dance floor, VIP area,
  cloakroom, DJ sets, karaoke) beyond assigning a category.

## 5. Proposed design

- Migrations add the attribute columns to both relation tables. Write paths and the
  relation schemas are renamed `Venue*` / `Experience*`; the legacy
  `VenueAmenityRelationSchema` with `venueId` is checked against the post-epic code.
- Curation follows the stage-3 process: inventory with production link counts,
  owner review, then a dual-write data-migration with remap-before-delete and 301s.
- Editor UX lives in the post-epic unified editor
  (`apps/web/src/components/listing/editor/*`) and in the host editor. Extract one
  shared catalog-picker component so the three verticals behave identically:
  - featured section (`is_featured`, ordered by `display_weight`);
  - a "show all" accordion per category;
  - a client-side search over the localized labels;
  - inline attribute controls once an item is checked.
- Admin: the venue and experience forms filter the catalog by `applicableVertical`.
  Today the admin loader may show the whole catalog, so verify this.
- Guard G-FAC-R1 applies: new identifiers and comments say "venue".

## 6. Acceptance criteria

- AC-1 Venue and experience owners can save the attributes, and the public detail
  shows them.
- AC-2 Every venue and experience feature has a category, and the catalog passes
  the duplicate guard from stage 3.
- AC-3 The three editors share one picker component, with featured-first, search
  and categories. Tests cover search and grouping.
- AC-4 The admin shows only vertical-applicable items for each listing type.
- AC-5 The public filters are grouped by category and consistent with HOS-1870's
  per-collection computation.

## 7. Risks

- R-1 The post-epic editor structure differs from today's. Mitigation: re-read the
  code on `origin/staging` after HOS-1787 lands, before writing tasks.

## 8. Open questions

- OQ-1 Whether the shared picker replaces both existing `AmenitiesSection`
  components or wraps them. Decide after reading the post-epic editor.

## 9. Linear

HOS-2061 (parent HOS-1016). Blocked by HOS-1787 and HOS-2058.

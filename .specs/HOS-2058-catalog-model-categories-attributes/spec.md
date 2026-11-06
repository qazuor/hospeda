---
title: Catalog model - feature categories and accommodation relation attributes
linear: HOS-2058
statusSource: linear
created: 2026-11-05
type: feature
areas:
  - db
  - api
  - web
  - admin
smokeGates:
  # Structural + data migrations against already-seeded environments.
  - status-needs-smoke-staging
---

# Catalog model: feature categories and accommodation relation attributes

Stage 2 of 5 of HOS-1016. Phase A, coordinating migration numbering with HOS-1787.

## 1. Summary

This stage does three things:

- gives `features` a category, as `amenities` already has;
- revisits the amenity category enum;
- adds `scope` and `availability` to `r_accommodation_amenity`.

The accommodation host editor, the admin and the public grids learn to render
categorized features and the new attributes.

## 2. Problem

- `features` has no category column (`packages/db/src/schemas/accommodation/feature.dbschema.ts`).
  All editors and grids render 80 accommodation features as one flat list.
- Dead `category` fields and `FeatureCategory*` schemas already exist with no DB
  backing. They are a trap for anyone who assumes features are categorized:
  - `feature.http.schema.ts:72`;
  - `amenity.http.schema.ts:79`;
  - `feature.crud.schema.ts:279`;
  - `feature.query.schema.ts:197`;
  - `feature.relations.schema.ts:59`.
- The amenity categories are lopsided:
  - SERVICES has 26 items and GENERAL_APPLIANCES 15, a mix of parking, bicycles,
    spa, gym and pet_friendly;
  - WORK_FRIENDLY and ACCESSIBILITY have 1 and 2.
- A pool cannot say whether it is private or shared, or whether it is seasonal,
  without extra catalog rows.

## 3. Goals

- G-1 Every feature row has exactly one category.
- G-2 The amenity categories partition the catalog meaningfully. Add only what
  regroups at least 3 existing items.
- G-3 The accommodation-amenity relation records `scope` and `availability`.
- G-4 The host editor, the admin and the public grids group features by category
  and show the new attributes.

## 4. Non-goals

- NG-1 Attributes on `r_venue_amenity` / `r_experience_amenity`. That is stage 5,
  blocked by HOS-1787.
- NG-2 Adding, removing or renaming catalog rows. That is stage 3.
- NG-3 Policies. That is stage 4.
- NG-4 Touching `components/listing/editor/*` or `apps/admin/src/features/venue/*`,
  which HOS-1787 is rewriting.

## 5. Proposed design

### 5.1 Feature category

- New `FeatureCategoryEnum` in `packages/schemas/src/enums/` and a pgEnum
  `features_category_enum`.
- New column `features.category`. Expand/contract:
  - nullable in release N, with a backfill data-migration;
  - `NOT NULL` in N+1 with `meta.requiresColumns`.
- Draft values, to be finalized in OQ-1:

  | Category | Covers |
  |---|---|
  | LOCATION | surroundings and zone |
  | VIEW | views |
  | ACCESS | road access |
  | STYLE | architecture and decor |
  | AUDIENCE | ideal-for and suitable-for |
  | OFFER_PROFILE | full rental, room rental, staff, rules-like traits |
  | SUSTAINABILITY | recycling, solar, rainwater |
  | CUISINE | venue cuisine types |
  | DIETARY | venue dietary options |
  | LANGUAGE | experience guide languages |

- Reuse or delete the dead `category` / `FeatureCategory*` schemas listed in
  section 2. Do not keep both.

### 5.2 Amenity categories

- Candidates: PARKING (parking, covered_parking, motorhome_parking,
  security_parking, bike_parking), LAUNDRY (washer, dryer, iron, laundry_service)
  and WATER_ACTIVITIES (kayaks, fishing_equipment, beach_equipment, plus the
  stage-3 nautical additions).
- Reassigning `type` on existing rows is a data-migration with a seed dual-write.
- A new enum value trips frozen guards (enum counts, inventories, mocks). Update
  them in the same PR.

### 5.3 Relation attributes (accommodation only)

- `r_accommodation_amenity.scope`: pgEnum `amenity_scope_enum` (`private`, `shared`), nullable.
- `r_accommodation_amenity.availability`: pgEnum `amenity_availability_enum`
  (`year_round`, `seasonal`), nullable.
- In both columns NULL means "not declared". Never infer a value.
- Reuse the same enums in stage 5 for venue and experience.
- Update `AccommodationAmenityRelationSchema` (`amenity.schema.ts`) and the write
  paths that persist accommodation amenities.

### 5.4 UI (files HOS-1787 does not touch)

- `apps/web/src/lib/catalog-categories.ts`: add a feature category order, labels
  and a `groupFeaturesByCategory` helper mirroring the amenity one.
- `apps/web/src/components/host/editor/AmenitiesSection.client.tsx`:
  - features as per-category accordions;
  - per-amenity scope and availability controls, shown only once the amenity is checked.
- `apps/web/src/components/accommodation/AmenitiesGrid.astro` and `FeaturesGrid.astro`:
  - group features by category;
  - show scope/availability badges next to the existing additional-cost badge.
- `apps/admin/src/components/entity-form/fields/entity-selects/AmenitySelectField.tsx`
  and the feature/amenity admin list and forms: a category column and editor for features.
- i18n: category labels in es, en and pt.

## 6. Data model / migrations

- Schema migrations come from `pnpm db:generate`. Staging is at 0188 and HOS-1787
  holds 0189-0191, so notify the epic session before merging, or regenerate after
  the epic lands.
- Data-migrations start at **0143**:
  - backfill `features.category` for all 106 rows;
  - reassign amenity `type` where 5.2 changes it.
- Seed baseline: add `category` to every `packages/seed/src/data/feature/*.json`,
  and update `packages/seed/src/schemas/feature.schema.json`.
- The epic's `feature/107-dj_sets` and `108-karaoke` need a category too. Coordinate
  with the epic session: either it adds the field, or the backfill covers those
  slugs when present.

## 7. Acceptance criteria

- AC-1 `features.category` exists. Every seeded row has a category, and the N+1 PR
  makes it `NOT NULL`.
- AC-2 No dead `category` / `FeatureCategory*` schema remains without a backing column.
- AC-3 The host editor renders features grouped by category and persists scope and
  availability. A test covers a round-trip save.
- AC-4 The public detail grids show features grouped by category and the
  scope/availability badges when declared.
- AC-5 The admin can view and edit a feature's category.
- AC-6 The frozen enum guards are updated deliberately, never deleted.

## 8. Risks

- R-1 Migration-number collision with HOS-1787. Mitigation: notify the epic
  session, or regenerate after it lands.
- R-2 A schema change (`.refine`, `NOT NULL`) can reject existing live data.
  Mitigation: expand/contract, and backfill before the constraint.

## 9. Open questions

- OQ-1 Final `FeatureCategoryEnum` values. Decide with the owner once a draft
  assignment of all 106 rows exists.
- OQ-2 Which amenity categories to add. Default: only those regrouping at least 3 items.

## 10. Linear

HOS-2058 (parent HOS-1016). Blocks HOS-2059 and HOS-2061.

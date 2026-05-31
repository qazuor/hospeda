---
id: SPEC-172
slug: accommodation-amenities-features-chips
title: Accommodation amenities & features — chips with junction tables (deprecate booleans)
status: draft
owner: qazuor
created: 2026-05-29
relatedSpecs:
  - SPEC-154  # admin entity view/edit redesign (form expects chips)
tags:
  - schemas
  - database
  - migration
  - admin
  - web
  - breaking
---

# SPEC-172 — Accommodation amenities & features — chips with junction tables (deprecate booleans)

## 1. Summary

Accommodation amenities (wifi, pool, parking, …) and features (whatever
"features" model represents — bbq grill, balcony, etc.) currently live as
hardcoded boolean columns on the accommodation entity (`hasWifi`, `hasPool`,
…). The proper relational catalog tables and junction tables ALREADY exist in
the database (`amenity`, `feature`, `r_accommodation_amenity`,
`r_accommodation_feature`) along with their Drizzle models and read-only
schemas (`AccommodationWithAmenitiesSchema`), but the write path was never
finished:

- `AccommodationCreate/UpdateInputSchema` do NOT accept `amenityIds[]` /
  `featureIds[]`.
- `accommodation.service.ts` does NOT sync the junction tables on
  create/update.
- The admin form has no multi-select chips component reading the catalog
  endpoint.
- Legacy boolean columns remain the source of truth.

This spec finishes the migration: introduce write paths, move admin + web
to read from junction, **delete the legacy booleans** (Option B chosen by
owner, accepting that web read paths break and must be migrated in lockstep).

## 2. Why now

- SPEC-154 entity redesign assumed chips. The accommodation edit form has a
  visible gap because the field can't be implemented against booleans
  cleanly.
- Booleans don't scale. Each new amenity is a migration. Search/faceting
  against booleans needs ad-hoc SQL.
- The catalog tables already exist with seed data. Half-finished is the
  worst state to leave it in.

## 3. Acceptance criteria

### Backend

- AC-1. `AccommodationCreateInputSchema` and `AccommodationUpdateInputSchema`
  accept optional `amenityIds: string[]` and `featureIds: string[]`.
- AC-2. `accommodation.service.create` and `.update` synchronize the junction
  tables transactionally (delete absent + insert added) and reject unknown
  IDs.
- AC-3. Read endpoints continue to expose amenities/features as objects (no
  consumer should have to look up names from IDs).
- AC-4. A data migration moves every `has<Amenity>=true` boolean to a
  corresponding row in `r_accommodation_amenity` (using a seed-mapped
  catalog ID).
- AC-5. The legacy boolean columns are **dropped** from
  `accommodation.dbschema.ts` and from `AccommodationSchema`. Same for
  features.

### Admin

- AC-6. New `MultiSelectChipsField` (or a name that fits the existing
  `EntityFormField` family) reads the catalog from a public-ish admin
  endpoint and renders multi-select with searchable chips.
- AC-7. The accommodation edit form uses the new field for amenities AND
  features, replacing the booleans area entirely.
- AC-8. SPEC-154 quality-score amenity signal evaluates as
  "amenities.length > 0" instead of inspecting individual booleans.

### Web

- AC-9. Every web read path that reads `hasWifi`/`hasPool`/etc. switches to
  reading `amenities[]` array and matching by slug. No boolean access left.
- AC-10. Detail pages, listings, and filter UI render amenities from the
  array (badges, chips, icons).
- AC-11. Search/faceting (if any) is updated to query the junction.

### Cross-cutting

- AC-12. `search_index` materialized view + triggers updated to project
  amenities/features text from junction tables, not from booleans.
- AC-13. Test fixtures (seed, e2e, vitest) updated to insert junction rows
  instead of setting booleans.

## 4. Open questions

- Q-1. What's in the `feature` table conceptually vs `amenity`? Are they
  truly two different domains (e.g., amenities = "what the accommodation
  has" / features = "experience/style descriptors") or can we collapse to
  one with a `kind` discriminator? **Owner decision needed.** Spec assumes
  they stay as two distinct catalogs.
- Q-2. Do we need a per-amenity `isOptional` / `additionalCost` projection
  on the relation (the read schema already supports them)? The current
  booleans don't carry that info, so migration defaults to `isOptional=false`
  and no additionalCost. **Confirm.**
- Q-3. Will the rollout be one big PR (atomic schema break) or staged
  (introduce write path → migrate data → cut over reads → drop booleans
  across multiple PRs)? Staged is safer; one PR is faster. **Owner pick.**
- Q-4. Locales for amenity/feature names: do the catalog tables already have
  i18n columns or do we add them? Check `amenity.dbschema.ts`.
- Q-5. Public API contract: does any external consumer rely on the boolean
  shape today? If yes, we may need a transition window with both shapes.

## 5. Scope (not in scope)

**In scope**:

- Schemas (create/update inputs + reads + base schema)
- Service-core junction sync
- DB migration (booleans → junction)
- Admin field component + form wire-up
- Web read-path migration (detail, listings, filters)
- Search index trigger update
- Test fixtures + e2e

**Not in scope**:

- New amenity/feature categories or catalog entries (data product call)
- Pricing/availability changes that touch amenities
- Multi-language i18n of catalog names beyond what already exists (separate
  ticket if needed)
- Mobile app changes (no mobile today)

## 6. Risks

- R-1. Breaking the web app during the migration window. Mitigated by
  staged rollout if Q-3 picks "staged", or by atomic PR + deploy if Q-3
  picks "big bang".
- R-2. Data migration drops or duplicates entries if the boolean → catalog
  mapping is incomplete (e.g., a boolean exists but no matching catalog
  row). Mitigated by pre-flight check that every boolean column has a
  catalog mapping before migrating.
- R-3. External API consumers (if any) get a breaking change. Mitigated by
  Q-5 audit.
- R-4. Search index drift if triggers aren't updated in the same migration.
  Mitigated by AC-12 + post-migration verification of `search_index` rows.

## 7. References

- Existing DB schema: `packages/db/src/schemas/accommodation/{amenity,feature,r_accommodation_amenity,r_accommodation_feature}.dbschema.ts`
- Existing read schemas: `packages/schemas/src/entities/accommodation/accommodation.relations.schema.ts`
  → `AccommodationWithAmenitiesSchema`, `AccommodationWithContentRelationsSchema`
- Origin: SPEC-154 entity view/edit redesign (out-of-scope ticket #4)

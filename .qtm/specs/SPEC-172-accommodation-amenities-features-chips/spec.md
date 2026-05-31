---
id: SPEC-172
slug: accommodation-amenities-features-chips
title: Accommodation amenities & features — complete write path, i18n catalog, admin chips UI
status: in-progress
owner: qazuor
created: 2026-05-29
updated: 2026-05-30
relatedSpecs:
  - SPEC-154  # admin entity view/edit redesign (form expects chips)
tags:
  - schemas
  - database
  - service-core
  - admin
  - web
  - i18n
---

# SPEC-172 — Accommodation amenities & features — complete write path, i18n catalog, admin chips UI

## 1. Summary

The accommodation entity already has junction-backed amenity and feature
relations (`r_accommodation_amenity`, `r_accommodation_feature`) and their
Drizzle models. However the write path is entirely missing and three
subsequent gaps compound from it:

1. `AccommodationCreateInputSchema` / `AccommodationUpdateInputSchema` do not
   accept `amenityIds[]` or `featureIds[]`, so junctions can never be set
   through the API.
2. `accommodation.service.ts` does not synchronize either junction on create
   or update.
3. The admin accommodation form has no multi-select chips UI for either
   relation.
4. The catalog tables store `name` and `description` as plain strings — no
   i18n — while the rest of the platform targets `{es, en, pt}`.
5. `AccommodationWithFeaturesSchema` declares three fields
   (`isOptional`, `additionalCost`, `additionalCostPercent`) that have no
   backing columns in `r_accommodation_feature`, making that schema partially
   phantom. `AccommodationWithAmenitiesSchema` declares the same three fields
   and they ARE backed by real columns in `r_accommodation_amenity`.

The virtual quick-amenity filters
(`hasWifi` → `['wifi']`, `hasPool` → `['pool','heated_pool']`, etc.) resolved
in `quick-amenity-resolver.ts` are intentional, documented, and NOT touched
by this spec.

## 2. Why now

- SPEC-154 entity redesign left the amenities/features chips field as an
  explicit out-of-scope follow-up. The accommodation edit form has a visible
  gap because the write path does not exist.
- The catalog tables have seed data. Half-finished infrastructure is worse
  than no infrastructure.
- The i18n gap becomes load-bearing as soon as chips are surfaced in the UI:
  the admin needs to present amenity names in the operator's locale.
- The phantom schema fields create a type-safety hole that will surface as
  runtime errors when features are eventually returned with those fields.

## 3. Acceptance criteria

Criteria are organized by the four staged PRs that constitute this spec's
delivery. Each AC is independently testable.

---

### PR1 — Write path (backend)

**AC-1.1.** `AccommodationCreateInputSchema` in
`packages/schemas/src/entities/accommodation/accommodation.crud.schema.ts`
accepts an optional `amenityIds: string[]` field (empty array treated as "no
amenities"; absent treated the same as empty).

**AC-1.2.** `AccommodationCreateInputSchema` accepts an optional
`featureIds: string[]` field with the same semantics as AC-1.1.

**AC-1.3.** `AccommodationUpdateInputSchema` in the same file accepts the
same optional `amenityIds` and `featureIds` fields.

**AC-1.4.** `accommodation.service.create` in
`packages/service-core/src/services/accommodation/accommodation.service.ts`
synchronizes `r_accommodation_amenity` transactionally: inserts rows for
every ID in `amenityIds`, inside the same DB transaction as the accommodation
insert. Any ID not present in the `amenity` catalog causes the entire
transaction to roll back with a typed error.

**AC-1.5.** `accommodation.service.update` synchronizes `r_accommodation_amenity`
transactionally using a delete-absent / insert-added diff (not a full wipe):
rows whose `amenityId` is no longer in the submitted `amenityIds` are deleted;
rows for new IDs are inserted; existing rows are left untouched. Unknown IDs
roll back the transaction.

**AC-1.6.** `accommodation.service.create` and `.update` apply the same
transactional sync logic to `r_accommodation_feature` (using `featureIds`).

**AC-1.7.** The standalone protected endpoints
`POST /api/v1/protected/features/accommodation/{accommodationId}` and
`DELETE /api/v1/protected/features/accommodation/{accommodationId}/{featureId}`
(`apps/api/src/routes/feature/protected/addFeatureToAccommodation.ts` and
`removeFeatureFromAccommodation.ts`) are **replaced** — the route files are
deleted and their functionality is subsumed by the updated `create`/`update`
service path. No amenity equivalents ever existed (confirmed).

**AC-1.8.** Unit tests cover: create with valid `amenityIds`/`featureIds`,
create with an unknown ID (expect rollback + typed error), update that adds
one amenity + removes another (diff verified at DB level), update with an
unknown featureId (expect rollback).

---

### PR2 — Schema cleanup + i18n catalog

**AC-2.1.** The three phantom fields (`isOptional`, `additionalCost`,
`additionalCostPercent`) are **removed** from
`AccommodationWithFeaturesSchema` in
`packages/schemas/src/entities/accommodation/accommodation.relations.schema.ts`
(lines 130-140). The same three fields in `AccommodationWithAmenitiesSchema`
(lines 153-163) are **kept** — they are backed by real `r_accommodation_amenity`
columns.

**AC-2.2.** `r_accommodation_feature` columns `hostReWriteName` and `comments`
remain in the DB schema and Drizzle model but are NOT exposed in
`AccommodationWithFeaturesSchema` (hidden for now per Q-2 decision).

**AC-2.3.** `amenity.dbschema.ts` migrates `name` (text) and `description`
(text) to JSONB columns `nameI18n: jsonb` and `descriptionI18n: jsonb` storing
`{es: string, en: string, pt: string}`. The old plain-text columns are dropped
in the same migration.

**AC-2.4.** `feature.dbschema.ts` applies the same JSONB migration as AC-2.3.

**AC-2.5.** Zod schemas for amenity (`packages/schemas/src/entities/amenity/amenity.schema.ts`,
lines 34-47) and feature (`packages/schemas/src/entities/feature/feature.schema.ts`)
are updated to validate the JSONB i18n shape
`{ es: z.string(), en: z.string(), pt: z.string() }` for both `nameI18n` and
`descriptionI18n`. The old plain `name`/`description` string fields are removed.

**AC-2.6.** Seed data in `packages/seed/` is updated so every amenity and
feature row carries all three locale strings. The seed script compiles without
TypeScript errors after AC-2.5.

**AC-2.7.** Public catalog read endpoints
`GET /api/v1/public/amenities` (`apps/api/src/routes/amenity/public/list.ts`)
and `GET /api/v1/public/features` (`apps/api/src/routes/feature/public/list.ts`)
return `nameI18n` and `descriptionI18n` objects. The cache TTL of 300 s is
unchanged.

**AC-2.8.** All existing read paths that surface `amenities[]` or `features[]`
on accommodation responses continue to include the relation objects (with the
updated i18n fields). No consumer receives bare IDs.

**AC-2.9.** A Drizzle migration file is generated (via `pnpm db:generate`) for
AC-2.3 and AC-2.4. TypeScript compilation (`pnpm typecheck`) passes after the
schema and Zod updates.

---

### PR3 — Admin chips UI + quality-signal rewrite

**AC-3.1.** A new `MultiSelectChipsField` component is added to the admin
accommodation form's field family (matching the naming and structural
conventions of existing `EntityFormField` variants in
`apps/admin/src/features/accommodations/`). It accepts a `fetchUrl` prop,
fetches the catalog once on mount (GET with a 5-minute client-side cache), and
renders a searchable multi-select chip list.

**AC-3.2.** `MultiSelectChipsField` displays chips using the `es` locale
string from `nameI18n` by default, falling back to `en` if `es` is absent.

**AC-3.3.** The accommodation edit form uses `MultiSelectChipsField` for
**amenities** (`fetchUrl = GET /api/v1/public/amenities`) and for **features**
(`fetchUrl = GET /api/v1/public/features`), submitting the selected IDs as
`amenityIds[]` and `featureIds[]` respectively.

**AC-3.4.** The field correctly pre-populates from the existing relation data
returned by the accommodation detail endpoint.

**AC-3.5.** The quality-score signal with `id: 'services'` in
`apps/admin/src/features/accommodations/config/score-signals.ts`
(currently lines 198-225, counting truthy virtual boolean keys) is rewritten
to evaluate `amenities.length >= 3` (full credit) or
`amenities.length >= 1` (partial credit) using the junction-backed
`amenities[]` array from the form values. The old `countTruthyKeys` call
referencing `['hasWifi','hasAirConditioning','hasParking','hasPool',
'hasKitchen','hasPetFriendly','hasGym','hasBreakfast']` is removed from this
signal.

**AC-3.6.** `apps/admin/src/components/quality-score/compute-score.ts` and
`AccommodationQualityScore.tsx` continue to work without modification — only
`score-signals.ts` changes.

**AC-3.7.** The chips field displays a loading skeleton while the catalog
fetch is in flight and an inline error state if the fetch fails (no crash).

**AC-3.8.** An empty catalog (zero results) renders an appropriate empty-state
message rather than a blank area.

---

### PR4 — Web read paths

**AC-4.1.** Every web component or page that reads accommodation data and
renders amenity-related information reads from `amenities[]` (junction-backed
array of objects) rather than from any virtual boolean derivation.

**AC-4.2.** The `search_index` materialized view projection and its supporting
triggers correctly include amenity and feature text sourced from the junction
tables (using the `es` locale string from `nameI18n`). No boolean column
reference remains in the trigger or view definition.

**AC-4.3.** Vitest fixtures and any seed helpers used in web-layer tests are
updated to insert rows into `r_accommodation_amenity` / `r_accommodation_feature`
rather than relying on any other amenity setup approach.

**AC-4.4.** `pnpm typecheck` passes across all packages and apps after PR4
changes.

---

## 4. Resolved decisions

The following questions were raised during spec drafting and resolved by the
owner on 2026-05-30 before implementation began.

**Q-1 (catalog architecture).** Amenity and feature remain as two distinct
catalogs. No `kind` discriminator collapse. The domains are conceptually
different (amenities = provided facilities; features = property
characteristics/experience descriptors).

**Q-2 (asymmetric junction schemas).** The three fields `isOptional`,
`additionalCost`, and `additionalCostPercent` are removed **only** from
`AccommodationWithFeaturesSchema` (they are phantom — no backing columns in
`r_accommodation_feature`). They are **kept** in `AccommodationWithAmenitiesSchema`
(real columns in `r_accommodation_amenity`). The feature junction columns
`hostReWriteName` and `comments` are left in the DB but not exposed in the
read schema for now.

**Q-3 (rollout strategy).** Staged multi-PR rollout across four PRs (PR1 →
PR2 → PR3 → PR4) as documented in section 3. Each PR is independently
deployable without breaking the next consumer tier.

**Q-4 (i18n for catalog names).** Both `amenity` and `feature` catalog tables
migrate `name`/`description` plain strings to JSONB i18n columns
`nameI18n`/`descriptionI18n` with shape `{es, en, pt}`. Handled in PR2.

**Q-5 (virtual filters).** The virtual quick-amenity filters
(`hasWifi`, `hasPool`, `hasParking`, `allowsPets`) resolved to amenity slugs
in `apps/api/src/routes/accommodation/public/quick-amenity-resolver.ts`
(SLUG_GROUPS map, lines 26-31) are **documented and retained**. They are a
deliberate API convenience layer and are not dropped by this spec.

---

## 5. Scope

### In scope

- `AccommodationCreate/UpdateInputSchema` — adding `amenityIds[]` and `featureIds[]`
- `accommodation.service.ts` — transactional junction sync for both relations
- Removal of standalone `addFeatureToAccommodation` / `removeFeatureFromAccommodation` endpoints
- Phantom field cleanup in `AccommodationWithFeaturesSchema`
- Amenity + feature catalog i18n migration (DB migration + Zod + seed)
- `MultiSelectChipsField` admin component
- Accommodation edit form wire-up for amenities and features chips
- Quality-score `services` signal rewrite in `score-signals.ts`
- Web read paths that surface amenities
- `search_index` trigger + view update for junction-sourced amenity text
- Test fixture updates

### Not in scope

- Dropping any boolean columns (there are none — the original spec premise
  was incorrect; no booleans to drop)
- Modifying the virtual quick-amenity resolver
  (`quick-amenity-resolver.ts`) or the `SLUG_GROUPS` mapping
- Adding new amenity or feature catalog entries (data product decision)
- Per-amenity pricing UI (additionalCost fields exist in the DB and schema;
  their edit UI is a separate concern)
- Exposing `hostReWriteName` or `comments` from `r_accommodation_feature`
  in any read schema
- Mobile app changes (no mobile today)

---

## 6. Risks

**R-1. Junction sync correctness.** A bug in the delete-absent / insert-added
diff could silently drop amenities on an update that does not include
`amenityIds`. Mitigated by requiring `amenityIds` to be explicitly absent (not
submitted) to mean "do not change" vs. `[]` meaning "remove all". The service
contract must document this distinction and AC-1.8 covers it.

**R-2. Migration data loss for existing amenity/feature names.** The JSONB
migration in PR2 must populate all three locale strings from the existing
plain-text values. A migration that copies the existing string into all three
locales (`{es: name, en: name, pt: name}`) is safe as a baseline; operators
can improve translations later. Mitigated by auditing seed data before
migrating.

**R-3. Search index drift.** If PR4's trigger update ships after PR2's catalog
schema change, there is a window where `search_index` references columns that
no longer exist. Mitigated by updating the trigger in PR2 (same migration) or
by keeping the old column alias until PR4 lands, with the PR ordering
explicitly respecting this dependency.

**R-4. PR3 chips field fetch failure in admin.** If the catalog endpoints are
slow or return errors, the admin form must not crash. Mitigated by AC-3.7
(loading skeleton + error state).

---

## 7. References

- Junction schemas: `packages/db/src/schemas/accommodation/r_accommodation_amenity.dbschema.ts`
  (lines 15-27), `r_accommodation_feature.dbschema.ts` (lines 6-26)
- Phantom field location: `packages/schemas/src/entities/accommodation/accommodation.relations.schema.ts`
  lines 130-140 (`AccommodationWithFeaturesSchema`) and 153-163 (`AccommodationWithAmenitiesSchema`)
- Input schemas: `packages/schemas/src/entities/accommodation/accommodation.crud.schema.ts`
  lines 25-73
- Virtual filter resolver: `apps/api/src/routes/accommodation/public/quick-amenity-resolver.ts`
  lines 26-31 (SLUG_GROUPS map)
- Standalone feature endpoints (to be deleted in PR1):
  `apps/api/src/routes/feature/protected/addFeatureToAccommodation.ts`,
  `apps/api/src/routes/feature/protected/removeFeatureFromAccommodation.ts`
- Catalog read endpoints: `apps/api/src/routes/amenity/public/list.ts`,
  `apps/api/src/routes/feature/public/list.ts` (cacheTTL 300 s)
- Quality signal: `apps/admin/src/features/accommodations/config/score-signals.ts`
  lines 198-225 (signal id `'services'`, `countTruthyKeys` to be replaced)
- Quality engine: `apps/admin/src/components/quality-score/compute-score.ts`,
  `AccommodationQualityScore.tsx`
- Origin: SPEC-154 entity view/edit redesign (out-of-scope follow-up item)

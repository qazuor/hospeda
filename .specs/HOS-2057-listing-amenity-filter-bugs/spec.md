---
title: Accommodation listing amenity filter truncates the catalog and leaks other verticals
linear: HOS-2057
statusSource: linear
created: 2026-11-05
type: fix
areas:
  - web
  - api
---

# Accommodation listing amenity filter truncates the catalog and leaks other verticals

Stage 1 of 5 of HOS-1016. Phase A, no overlap with HOS-1787.

## 1. Summary

The `/alojamientos/` listing builds its amenity and feature filters from a request
that:

- is capped below the catalog size;
- is not scoped to accommodation;
- sorts by a dropped column.

The same PR removes dead association schemas and hardcoded vertical enums.

## 2. Problem

Measured on `origin/staging` bdb902b771:

- `apps/web/src/pages/[lang]/alojamientos/index.astro:173-175`:
  - `amenitiesApi.list({ pageSize: 100, isActive: true, sortBy: 'name', ... })`;
  - `featuresApi.list({ pageSize: 100, sortBy: 'displayWeight', ... })`.
- The server clamps `pageSize` to `MAX_PAGE_SIZE = 100` (`apps/api/src/utils/pagination.ts:9,63`).
  The shared pagination schema also caps it with `.max(100)`. The catalog has
  110 amenities, so 10 never appear as filters.
- Neither call passes `applicableVertical`. Venue-only and experience-only items,
  such as delivery, happy hour or guide included, show up as accommodation filters.
- `sortBy: 'name'` targets the column SPEC-266 dropped. The page's own comment at
  line 219 acknowledges this.
- `packages/schemas/src/entities/accommodation/subtypes/accommodation.amenity.schema.ts`
  and `accommodation.feature.schema.ts` declare fields that have no DB column:
  `price`, `isIncluded`, `notes` and `isHighlighted`. Their only importers are the
  barrel `subtypes/index.ts:7,11` and two tests.
- `feature.http.schema.ts:28` and `:68-69`, and `amenity.http.schema.ts:74-75`,
  hardcode `z.enum(['accommodation','venue','experience'])` instead of reusing
  `ApplicableVerticalSchema` (`amenity.schema.ts:18`).

## 3. Goals

- G-1 The listing filter shows every active accommodation-applicable amenity and
  feature, and only those.
- G-2 No catalog request sorts by a dropped column.
- G-3 Dead association schemas are removed.
- G-4 One source of truth for the vertical enum.

## 4. Non-goals

- NG-1 Grouping filters by category. That is stage 2 (HOS-2058) and stage 5 (HOS-2061).
- NG-2 Raising the global `MAX_PAGE_SIZE`.

## 5. Proposed design

- Pass `applicableVertical: 'accommodation'` to both catalog calls on the listing.
  Sort amenities by `displayWeight` desc, like features.
- Fetch the full catalog regardless of size. Either page through it (loop until
  `total` is reached), or add a dedicated unpaginated catalog read for public
  filters. Pick whichever matches an existing pattern (see OQ-1).
- Audit the other pages that build the same filter groups and apply the same fix:
  - `alojamientos/mapa.astro`;
  - `alojamientos/tipo/[type]/index.astro`;
  - `alojamientos/comodidades/[slug]/*`;
  - any consumer of `lib/filters/accommodations-filter-groups.ts`.
- Delete `AccommodationAmenitySchema` and `AccommodationFeatureSchema`, together
  with their barrel exports and tests, after confirming zero `src` consumers.
- Replace the hardcoded enums with `ApplicableVerticalSchema`.

## 6. Acceptance criteria

- AC-1 Regression test, written first:
  - the listing's catalog fetch passes `applicableVertical: 'accommodation'`;
  - it retrieves more than 100 rows when the catalog has more.
- AC-2 With the seeded catalog, the listing filter contains exactly the active
  amenities whose `applicableVerticals` includes `accommodation`. Today that is 92;
  confirm the number on staging at implementation time.
- AC-3 `rg "sortBy: 'name'"` returns no amenity or feature catalog call.
- AC-4 The removed schemas have no remaining references, and `@repo/schemas`
  builds and typechecks.
- AC-5 No hardcoded vertical enum remains in the amenity and feature HTTP schemas.

## 7. Risks

- R-1 Other pages share the same filter-group builder and keep the bug if only
  `index.astro` is fixed. Mitigation: the audit in section 5.

## 8. Open questions

- OQ-1 Page-through versus a dedicated catalog endpoint. Prefer whatever the admin
  `utils/amenity-api.utils.ts` loader already does, if it pages.

## 9. Linear

HOS-2057 (parent HOS-1016).

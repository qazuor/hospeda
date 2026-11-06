---
title: Amenity and feature catalog redesign (umbrella)
linear: HOS-1016
statusSource: linear
created: 2026-11-05
type: feature
areas:
  - db
  - api
  - web
  - admin
  - content
---

# Amenity and feature catalog redesign (umbrella)

## 1. Summary

The shared amenity/feature catalog serves accommodation, venue and experience
listings, but nothing defines what belongs in each table. The result is
duplicated concepts, policies stored as checkboxes, and a flat, uncategorized
feature list. This umbrella records the model decisions and splits the work
into five stage specs, two of which wait for the HOS-1787 epic.

## 2. Problem

Measured on `origin/staging` bdb902b771 (2026-11-05):

- `amenities` has 110 rows and a 12-value `type` category. `features` has 106 rows
  and **no category at all**, so every UI renders features as one flat list.
- Accommodation alone exposes 92 amenities + 80 features (172 options), so the
  problem is not quantity. It is organization.
- No document defines amenity vs feature (`docs/resources/glossary.md:55-65` has
  no Feature entry). Concepts drift across tables:
  - `laundry_service` and `luggage_storage` exist in both tables;
  - pets are modeled three times (`pet_friendly`, `pet_suitable`, `pet_friendly_area`);
  - smoking is modeled twice (`smoke_free`, `smoking_area`), plus `extra_info.smokingAllowed`.
- Policies live in the catalog as checkboxes: `accepts_cards`, `autonomous_checkin`
  and `minimum_stay_required`, alongside the pets and smoking items above.
  There are no structured fields for check-in/out times, payment methods or pets.
- Relation attributes are asymmetric. Only `r_accommodation_amenity` carries cost
  attributes; `r_venue_amenity` and `r_experience_amenity` carry none.

## 3. Owner decisions (2026-11-05)

- **D-1 Two tables, written rules.**
  - An **amenity** is something the visitor USES: equipment, a facility or a service.
  - A **feature** is what the place IS: surroundings, view, access, style, audience or offer profile.
  - Features gain a category.
- **D-2 Policies leave the catalog** for a `policies` jsonb per listing. It holds a
  shared base (payment methods, pets, smoking, events) plus a per-vertical extension.
- **D-3 Generic relation attributes** on every listing-amenity relation:
  - `scope` (private | shared);
  - cost (the existing `is_optional` + `additional_cost[_percent]`);
  - `availability` (year_round | seasonal).

  Variants that change the offer, such as a heated pool, stay as their own catalog row.
- **D-4 Vertical-specific vocabulary stays in `features`** under scoped categories:
  cuisine and dietary for venue, audience and language for experience. This is
  consistent with how HOS-1073 and HOS-1054 were resolved (catalog rows, no columns).
- **Admission rule:** an item belongs in the catalog only if someone would choose
  or reject a place because of it. Baseline items such as toilet paper, hangers or
  hot water are out.

Rejected options:

- Merging both tables into one catalog. Large refactor for a problem that rules solve.
- Per-amenity attribute schemas, as in an EAV model.
- Per-unit amenities. YAGNI while units are not modeled.
- Wi-Fi speed in Mbps. It is unverifiable and goes stale.

## 4. Stages

| Stage | Issue | Spec | Phase |
|---|---|---|---|
| 1. Listing filter bugs + dead schemas | HOS-2057 | `HOS-2057-listing-amenity-filter-bugs` | A |
| 2. Model: feature categories + accommodation relation attributes | HOS-2058 | `HOS-2058-catalog-model-categories-attributes` | A |
| 3. Accommodation catalog curation + written rule + guard | HOS-2059 | `HOS-2059-accommodation-catalog-curation` | A (after 2) |
| 4. Policies as data | HOS-2060 | `HOS-2060-listing-policies` | B |
| 5. Venue/experience attributes, curation and editor UX | HOS-2061 | `HOS-2061-venue-experience-catalog-and-editors` | B |

## 5. Coordination with HOS-1787 (agreed with the epic session, 2026-11-05)

HOS-1787 (`epic/HOS-1787-comer-y-salir`) is an umbrella branch. It reaches
`staging` in one PR and has no fixed close date. It is rewriting:

- the unified listing editor `apps/web/src/components/listing/editor/*`;
- the venue admin `apps/admin/src/features/venue/*`;
- the experience API routes;
- the venue detail and `rubro` pages.

It also adds:

- schema migrations 0189-0191 (`business_lines` on the three listing tables;
  venue `entry_kind`, `min_age`, `dress_code`);
- data-migrations 0134-0135;
- seed files `amenity/111-113` and `feature/107-108` (dance floor, VIP area,
  cloakroom, DJ sets, karaoke).

It does not touch:

- `AmenitiesGrid.astro`, `FeaturesGrid.astro`, `lib/catalog-categories.ts`;
- `AmenitySelectField.tsx`, `quick-amenity-resolver.ts`;
- the host editor `AmenitiesSection`;
- the amenity/feature schemas or dbschemas.

Phases:

- **Phase A (stages 1-3)** may proceed now.
- **Phase B (stages 4-5)** is blocked until HOS-1787 lands on `staging`.

Numbering rules:

- New data-migrations start at **0143**. Numbers 0136-0142 are reserved for the epic.
- Before merging any `db:generate` output to `staging`, notify the epic session,
  or regenerate after the epic lands.
- New seed files must start after the epic's numbers, or be renumbered on merge.
- Guard G-FAC-R1 (`scripts/check-venue-retired-word.ts`) rejects the retired
  vertical name in any new code or comment. Use "venue".

## 6. Acceptance criteria (umbrella)

- AC-1 All five stage issues are Done or explicitly Canceled.
- AC-2 The amenity/feature/policy rule is documented in the glossary and the entity
  model reference, and a guard prevents a slug from existing in both tables.
- AC-3 No catalog row models a policy once stage 4 completes.

## 7. Linear

Canonical tracking: HOS-1016 (children HOS-2057 to HOS-2061).

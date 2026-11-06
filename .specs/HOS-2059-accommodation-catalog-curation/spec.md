---
title: Accommodation catalog curation, written rule and duplicate guard
linear: HOS-2059
statusSource: linear
created: 2026-11-05
type: feature
areas:
  - content
  - db
  - web
smokeGates:
  - status-needs-smoke-staging
---

# Accommodation catalog curation, written rule and duplicate guard

Stage 3 of 5 of HOS-1016. Phase A, after stage 2 (HOS-2058).

## 1. Summary

HOS-1016's original request: what is missing, what is extra and which labels need
rewriting. This stage applies it to the accommodation catalog on top of the
categorized model, writes the amenity/feature rule down, and adds a guard so
duplicates cannot come back.

## 2. Problem

- `laundry_service` and `luggage_storage` exist as both amenity and feature.
- The same concept is split across tables: pets (`pet_friendly`, `pet_suitable`,
  `pet_friendly_area`), smoking (`smoke_free`, `smoking_area`) and Wi-Fi (`wifi`,
  `wifi_full_property`).
- Items the Litoral market searches for have nowhere to be marked: docks,
  moorings, boat ramps, hot-spring access, nautical gear, a fire pit as an amenity.
- Some labels are ambiguous for the host (HOS-1016 item 3).
- `docs/resources/glossary.md:55-65` has no Feature entry, and
  `docs/architecture/entity-model-reference.md:712-735` is stale: it shows `name`
  and the old type enum.

## 3. Goals

- G-1 Each concept exists exactly once, in the right table under the D-1 rule.
- G-2 Every accommodation item passes the admission rule.
- G-3 Litoral-specific items are added.
- G-4 Labels are clear in es, en and pt.
- G-5 The rule is documented, and a CI guard enforces one-slug-one-table.

## 4. Non-goals

- NG-1 Venue and experience items. Those are stage 5, after HOS-1787. Never touch
  `dance-floor`, `vip-area`, `cloakroom`, `dj_sets` or `karaoke`.
- NG-2 Deleting policy items (pets, smoking, cards, autonomous check-in, minimum
  stay). Stage 4 converts them into data first. Here they are only tagged as
  pending migration.

## 5. Proposed design

1. **Inventory first.** For every accommodation-applicable slug, collect:
   - category and verticals;
   - the es, en and pt labels;
   - the count of production accommodations linking it.

   Use read-only `hops psql --target=prod` and exclude soft-deleted rows. The
   inventory goes in `docs/inventory.md` inside this spec folder. Nothing is
   removed without it.
2. **Owner review.** For each row, decide keep, rename label, reclassify, merge
   into X, or retire. Present the decisions batched, with a recommendation per row.
3. **Apply,** with the seed dual-write:
   - edit the baseline JSON in `packages/seed/src/data/{amenity,feature}`;
   - add one data-migration starting at **0143**.
   - Merges and retirements remap existing relation rows to the surviving slug
     before deleting, so no listing loses data silently.
   - New rows take seed numbers after the epic's `amenity/113` and `feature/108`,
     or are renumbered on merge.
4. **SEO.** A retired or merged slug's `/[lang]/alojamientos/comodidades/<slug>/`
   returns a 301 to the surviving slug's page, or to the listing.
5. **Docs.** Write the D-1 rule (amenity = used, feature = is, policy = rule of the
   house) in the glossary and the entity model reference, and fix the stale
   Amenity block.
6. **Guard.** Add a script or test that fails when a slug appears in both the
   amenity and the feature seed catalogs. Wire it into `pnpm check:guards` AND
   verify that it runs in CI.

## 6. Acceptance criteria

- AC-1 The inventory exists, including production link counts.
- AC-2 No slug exists in both catalogs. The guard fails on a planted duplicate
  (mutation-checked).
- AC-3 Every retired or merged slug:
  - has its relation rows remapped (row counts before and after recorded);
  - has a working 301.
- AC-4 New Litoral items exist with es, en and pt labels and a category.
- AC-5 The glossary and the entity model reference define amenity, feature and
  policy, and match the code.
- AC-6 Running the data-migration on a staging copy leaves no orphaned relation rows.

## 7. Risks

- R-1 Retiring a slug that live listings use loses host data. Mitigation: remap
  before delete, and count before and after.
- R-2 Seed-number collision with HOS-1787. Mitigation: start after the epic's numbers.

## 8. Open questions

- OQ-1 The keep, merge and retire list. It is an owner decision based on the inventory.

## 9. Linear

HOS-2059 (parent HOS-1016). Blocked by HOS-2058.

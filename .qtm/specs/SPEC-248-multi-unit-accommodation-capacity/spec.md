---
specId: SPEC-248
title: Multi-unit accommodation capacity model (hotels & complexes that rent per unit)
slug: multi-unit-accommodation-capacity
type: feature
complexity: high
status: draft-exploration
owner: qazuor
created: 2026-06-19
base: staging
tags:
  - accommodation
  - capacity
  - product-design
  - hotels
  - schemas
relatedSpecs:
  - SPEC-217
  - SPEC-205
linearIssues: []
---

# SPEC-248 — Multi-unit accommodation capacity model

> **Status: draft-exploration.** This spec captures a product/modeling problem
> surfaced during the SPEC-217 write-gate smoke. It documents the problem, the
> current technical reality, and the open product questions. It does NOT yet
> propose a design — the design decisions below belong to the owner and must be
> resolved before task generation. No worktree (exploration only).

## 1. Origin & problem statement

During the SPEC-217 write-gate browser smoke (2026-06-19, staging-readiness), the
web accommodation editor refused to save edits for large accommodations. Root cause:
`AccommodationCreateHttpSchema` capped capacity at **20 guests / 10 bedrooms /
10 bathrooms**, and the web `CapacitySection` mirrored those as HTML5 `max`
attributes — so seeded hotels (e.g. 45 guests / 22 rooms) were natively `:invalid`
and the `type=submit` Save button was silently blocked.

That was patched (PR #1733) by raising the ceilings to high technical caps
(200 / 100 / 100). **That patch is an interim unblock, not a real model.** It treats
a hotel as "a very big house", which is wrong.

The deeper problem the owner flagged: **hotels and multi-unit complexes are not a
single rentable unit.** Examples:

- A **complex of 10 cabins** rents each cabin independently. "Capacity 40" (4 per
  cabin × 10) is meaningless to a guest who books ONE cabin for 4 people.
- A **hotel with 22 rooms** sells rooms (and room types), not the whole building.
  Total guest capacity, total bedrooms, and total bathrooms describe the property,
  not the bookable unit.

A single flat `{ capacity, bedrooms, bathrooms }` triple on the accommodation cannot
faithfully represent "a property made of N independently-rentable units, each with
its own capacity / price / availability".

## 2. Why now

- The interim cap (PR #1733) keeps the data enterable but encodes a wrong mental
  model; the longer it stays, the more downstream code (search filters, pricing,
  availability, AI search `maxGuests`) hardens around "one accommodation = one unit".
- Commerce/experiences specs (SPEC-239/240) are expanding the catalog; getting the
  unit model right for accommodations before more surfaces consume it reduces rework.
- Search and booking UX for hotels/complexes is currently degraded (a 10-cabin
  complex shows as one listing with a confusing aggregate capacity).

## 3. Current technical reality (discovered, not designed)

- **Domain schema** `AccommodationExtraInfoSchema`
  (`packages/schemas/src/entities/accommodation/accommodation.schema.ts`): flat
  `capacity`, `bedrooms`, `bathrooms`, `minNights`, `beds?`, `maxNights?` — all
  `z.number().int()`, **no max**, single values per accommodation.
- **HTTP schemas** `AccommodationCreateHttpSchema` / `AccommodationUpdateHttpSchema`
  (`accommodation.http.schema.ts`): capacity now capped at 200/100/100 (PR #1733).
- **Accommodation type enum** already distinguishes `HOTEL`, `RESORT`, `HOSTEL`,
  `CABAÑA` (cabin), `APARTMENT`, `ROOM`, etc. — but type does NOT change the
  capacity model today; all types share the same flat triple.
- There is no concept of a "rentable unit" / "room type" / sub-listing under an
  accommodation anywhere in the schema or DB.
- Web edit form: `apps/web/src/components/host/editor/CapacitySection.client.tsx`.
- Search/filter uses `maxGuests` (`accommodation.query.schema.ts`); AI search caps
  `maxGuests` at 50 (`ai-search-intent.schema.ts`).

## 4. Open product questions (OWNER decisions — do NOT pre-decide)

These must be answered before any task generation:

- **OQ-1 — Scope of the unit model.** Do we introduce a first-class "rentable unit"
  (room type / cabin) entity under an accommodation, or model multi-unit via a
  lighter mechanism (e.g. a `units[]` array on the accommodation, or a `unitCount`
  - per-unit-capacity pair)? Tradeoff: full sub-entity (richest, biggest change:
  booking, pricing, availability, search all fork) vs lightweight attribute
  (cheaper, less faithful).
- **OQ-2 — Which types are multi-unit?** Only `HOTEL` / `RESORT` / `HOSTEL` /
  multi-`CABAÑA` complexes? Is "complex" a new type or a flag on existing types?
  How does a single cabin differ from a 10-cabin complex in the model?
- **OQ-3 — Capacity semantics.** When a property is multi-unit, what does the
  top-level `capacity` mean (sum? max single unit? hidden)? What does search match
  against — per-unit capacity or total?
- **OQ-4 — Pricing & availability.** Out of scope for this spec, or in? Per-unit
  pricing/availability is the natural consequence of a unit model; decide whether
  SPEC-248 covers only the capacity/representation or the full booking surface.
- **OQ-5 — Migration.** Existing accommodations have flat capacity. How do we
  migrate a seeded "hotel, capacity 45" into the new model (backfill a single
  implicit unit? leave flat until edited?).
- **OQ-6 — Interim cap.** Keep the 200/100/100 cap (PR #1733) until this ships, or
  revisit once the unit model lands?

## 5. Out of scope (provisional — revisit after OQs)

- Booking engine changes, calendar/availability per unit (unless OQ-4 pulls them in).
- Payment/commission changes.
- The interim capacity cap (already shipped in PR #1733).

## 6. Next step

Owner resolves OQ-1..OQ-6 (a short working session). Only then: run
`/task-master:spec` to turn this exploration into a formal spec with user stories
and tasks, and flip `status` to `draft` → `in-progress` + create a worktree.

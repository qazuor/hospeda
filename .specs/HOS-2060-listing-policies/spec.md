---
title: Listing policies as data (pets, smoking, payment, check-in, events)
linear: HOS-2060
statusSource: linear
created: 2026-11-05
type: feature
areas:
  - db
  - api
  - web
  - admin
smokeGates:
  - status-needs-smoke-staging
---

# Listing policies as data

Stage 4 of 5 of HOS-1016. **Phase B: blocked until HOS-1787 lands on `staging`.**
It touches the venue and experience tables and the unified listing editor, which
the epic is rewriting.

## 1. Summary

Move house rules out of the amenity/feature catalog into a structured `policies`
jsonb on each listing table (owner decision D-2, 2026-11-05).

## 2. Problem

A checkbox such as "pets allowed" cannot say "on request" or "extra charge". It
cannot feed reliable filters, and it cannot populate structured data. Today:

- **accommodation:**
  - `extra_info.smokingAllowed`, `minNights` and `maxNights`
    (`AccommodationExtraInfoSchema`,
    `packages/schemas/src/entities/accommodation/accommodation.schema.ts:47-76`);
  - no check-in or check-out time, payment methods or pets policy.
- **experience:**
  - `cancellation_policy` is free text (`experiences.dbschema.ts:234`);
  - `accepts_private_groups` is a boolean column (`:250`).
- **venue:** nothing on staging. HOS-1787 migration 0191 adds `entry_kind`,
  `min_age` and `dress_code`.
- **Catalog rows that are policies:**
  - amenities `pet_friendly`, `smoke_free`, `accepts_cards`, `private_events`;
  - features `pet_suitable`, `pet_friendly_area`, `autonomous_checkin`,
    `minimum_stay_required`, `smoking_area`.
- The `allowsPets` quick filter reads the `pet_friendly` amenity
  (`apps/api/src/routes/accommodation/public/quick-amenity-resolver.ts`).

## 3. Goals

- G-1 One shared policy schema in `@repo/schemas`, extended per vertical.
- G-2 Policies are filterable, render on detail pages and feed JSON-LD
  (`petsAllowed`, `checkinTime`, `checkoutTime`, `paymentAccepted`).
- G-3 No catalog row models a policy once the stage completes.

## 4. Non-goals

- NG-1 Cancellation-policy engines or refunds. Cancellation stays descriptive.
- NG-2 Booking-time enforcement of the policies.

## 5. Proposed design

- **Column:** `policies jsonb` on `accommodations`, `venues` and `experiences`,
  validated by Zod on write.
- **Shared base** (`ListingPoliciesBaseSchema`):

  | Field | Shape |
  |---|---|
  | `paymentMethods` | array of `cash`, `debit`, `credit`, `transfer`, `mercadopago`, ... |
  | `pets` | `{ admission: 'no' \| 'yes' \| 'on_request', extraCost?, notes? }` |
  | `smokingAllowed` | `'no' \| 'yes' \| 'outdoor_only'` |
  | `eventsAllowed` | boolean |

- **Per-vertical extensions:**

  | Vertical | Fields |
  |---|---|
  | accommodation | `checkIn` and `checkOut` (`{ from?, to? }` as `HH:mm`), `minNights` and `maxNights`, moved from `extra_info` |
  | venue | `reservations: 'required' \| 'recommended' \| 'not_accepted'`; whether `entry_kind`, `min_age` and `dress_code` from 0191 move here is OQ-1 |
  | experience | `privateGroups` (from `accepts_private_groups`), `cancellation` (from `cancellation_policy`) |

- **Expand/contract:**
  - release N adds `policies` and backfills it, through a data-migration, from:
    - `extra_info`;
    - the experience columns;
    - the policy catalog rows linked to each listing.
  - Release N+1 drops the old fields and retires the policy catalog rows, with
    `meta.requiresColumns`. Retired slugs 301 as in stage 3.
- **Filters:** `allowsPets` reads `policies.pets.admission in ('yes','on_request')`.
  Add an index (GIN or expression) only if a measured query needs it.
- **UI:**
  - a "Policies" section in the host editor and the unified listing editor;
  - in the admin forms;
  - and on the public detail pages.

## 6. Acceptance criteria

- AC-1 All three tables have `policies`, validated by Zod, and readable through the
  public schemas.
- AC-2 The backfill maps every listing's existing smoking, pets, minimum-stay,
  private-group and cancellation data, with counts before and after.
- AC-3 The `allowsPets` filter returns the same set before and after the backfill
  (regression test).
- AC-4 JSON-LD includes the populated policy fields.
- AC-5 After N+1, no policy catalog row remains and the old fields are gone.

## 7. Risks

- R-1 The backfill runs in the same release as the drop of its source (the HOS-433
  pattern). Mitigation: strict N / N+1 split and `meta.requiresColumns`.
- R-2 Conflicting sources, for example `smokingAllowed=true` together with the
  `smoke_free` amenity. Mitigation: a documented precedence rule; log the conflicts.

## 8. Open questions

- OQ-1 Whether the venue entry, age and dress-code columns from HOS-1787 move into
  `policies` or stay as columns. Decide after the epic lands.
- OQ-2 The final payment-method list.

## 9. Linear

HOS-2060 (parent HOS-1016). Blocked by HOS-1787.

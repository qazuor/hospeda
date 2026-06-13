---
spec-id: SPEC-227
title: Accommodation partial-update data loss — partial JSONB objects + shallow-merge nested columns
type: fix
complexity: medium
status: draft
created: 2026-06-13T00:00:00Z
---

# SPEC-227 — Accommodation partial-update data loss

## Overview

**Goal.** Make partial updates of an accommodation correctly persist single fields
that live inside grouped JSONB columns (`price`, `extra_info`, `contact_info`,
`social_networks`, `location`). Today, changing **only** one field of such a group
either silently does nothing (HTTP 200, no change) or is rejected, because the HTTP→domain
converter drops partial groups and the DB layer replaces (not merges) JSONB columns.

**Severity.** Silent data loss with a false-success signal. The host web property
editor reports "saved" while the change is discarded. Affects every consumer of the
accommodation update path (web editor, admin panel, direct API).

## Problem & evidence (verified live)

Reproduced against `PATCH /api/v1/protected/accommodations/:id` with a real owner
session (worktree DB), 2026-06-13:

| PATCH body | HTTP | Result | Expected |
|---|---|---|---|
| `{ currency: "USD" }` (no `basePrice`) | 200 `success:true` | currency stayed `ARS` | currency → USD |
| `{ basePrice: 50000, currency: "USD" }` | 200 | price + currency both applied ✓ | (works) |
| `{ bedrooms: 8 }` (no maxGuests/bathrooms) | 200 `success:true` | bedrooms stayed 20 | bedrooms → 8 |
| `{ maxGuests: 6, bedrooms: 4, bathrooms: 2 }` | 200 | all three applied ✓ | (works) |

So the change only persists when the **entire group** is sent. The web editor's
`buildPatchPayload` sends only changed fields, so single-field edits of price/currency
or capacity/bedrooms/bathrooms are lost.

## Root cause

Two compounding layers:

1. **Converter drops partial groups.** `httpToDomainAccommodationUpdate`
   (`packages/schemas/src/entities/accommodation/accommodation.http.schema.ts`,
   ~lines 646-739) only emits:
   - `price` when `basePrice !== undefined` (so a lone `currency` is dropped),
   - `extraInfo` when `maxGuests` **and** `bedrooms` **and** `bathrooms` are all present,
   - `location` when both `latitude` and `longitude` are present.
   It is a **pure function** (no access to the current row), so it cannot merge by itself.

2. **DB replaces JSONB, not merges.** `BaseModelImpl.update` does `SET column = value`
   (`packages/db/src/base/base.model.ts`). A shallow-merge path exists
   (`_updateWithMerge` + `packages/db/src/utils/jsonb-merge.ts`, PostgreSQL `||`) but is
   gated by `mergeableJsonbColumns`, which on `AccommodationModel` contains **only `media`**
   (`packages/db/src/models/accommodation/accommodation.model.ts:371`). So even if the
   converter produced `price: { currency: "USD" }`, the model would overwrite the whole
   `price` column and drop the amount.

## Proposed solution

Two coordinated changes (both required):

1. **Converter — emit partial objects.** Change `httpToDomainAccommodationUpdate` so
   each grouped object is built from whatever fields are present (e.g. `price: { currency }`
   without `price`, `extraInfo: { bedrooms }` alone). Verify the domain
   `AccommodationUpdateInput` schema accepts these partials (make the nested fields
   optional if it does not).

2. **DB — enable shallow-merge for the nested columns.** Add `price`, `extraInfo`,
   `contactInfo`, `socialNetworks`, `location` to `AccommodationModel.mergeableJsonbColumns`
   so `_updateWithMerge` preserves the sibling keys via `||`. The merge infrastructure
   already exists; this is config + tests.

> `||` is a **shallow** merge at the column-object level — sufficient here because the
> grouped objects are one level deep (e.g. `price.{price,currency}`). `location.coordinates`
> is replaced as a unit, which is correct (lat+long always travel together).

## Risks

- Changing JSONB persistence from replace→merge alters behavior for **all** accommodation
  update callers (admin, API). A consumer that intended to *replace* a whole `price`/`extraInfo`
  object would now merge instead. Audit admin + API update flows.
- Shallow merge will not clear a nested key by omission; explicit `null` semantics for
  "remove this field" must be defined and tested.
- Needs regression tests across `@repo/schemas` (converter), `@repo/db` (merge), and an
  api integration test that reproduces the table above.

## Acceptance criteria

- AC-1: `PATCH { currency }` alone changes the currency and preserves the amount.
- AC-2: `PATCH { bedrooms }` alone changes bedrooms and preserves capacity/bathrooms (and all other extraInfo keys).
- AC-3: The same holds for a single `contact_info` / `social_networks` / `location` field.
- AC-4: Sending a full group still works exactly as today (no regression).
- AC-5: Admin + direct-API update flows audited; no unintended merge-vs-replace regressions.
- AC-6: Regression tests in schemas + db + api cover the table in "Problem & evidence".

## Out of scope

- The web editor `buildPatchPayload` (no change needed once the backend merges correctly;
  it already sends minimal diffs).
- The `bedrooms`/`bathrooms` `<= 10` validation limit (seed has hotels with 20 rooms that
  then cannot be edited) — tracked separately; decide whether the cap is correct for hotels.

## Context

Found during the 2nd-pass review of `/mi-cuenta/propiedades/[id]/editar`. The sibling
UX bug (no success feedback on save) was fixed in the web layer separately
(PR for `fix/web-mi-cuenta-propiedades`). This spec covers only the backend data-loss fix.

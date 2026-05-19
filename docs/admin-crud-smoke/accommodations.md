# CRUD smoke — accommodations (D-1)

- **Date:** 2026-05-15
- **Operator:** <superadmin@hospeda.com> (SUPER_ADMIN)
- **Marker:** `SMOKE-2026-05-15-accom`
- **Test row id:** (not created — BLOCKED on D-ACCOM.1 schema/form mismatch)
- **Branch:** `fix/admin-pages-audit`

> **Pre-requisites validated in this smoke:**
>
> - M-1 (admin plan-limit bypass) — `/accommodations/new` loads as SUPER_ADMIN without the limit gate. ✅
> - A-6 (accommodations/{id} detail) — not exercised because Create failed.
> - D-RELATIONS.1 — partially fixed under this branch (`ownerId` USER_SELECT, `destinationId` DESTINATION_SELECT both confirmed working: ownerId server-search returned `Admin User`, destinationId client-search returned 27 destinations including `Concepción del Uruguay`). ✅

| Step | Result | Notes |
|------|--------|-------|
| 1 List baseline | ⏭️ | Not exercised in this run (focus was Create flow per blocker chain in spec §4.D-1). |
| 2 Create — fill flat + entity selects | ✅ | name, description, address, city, country, state, type=CABIN, destinationId=Concepción del Uruguay, ownerId=Admin User. |
| 3 Submit | 🔴 | **D-ACCOM.1 below.** POST `/api/v1/admin/accommodations` → 400 VALIDATION_ERROR. Schema requires `summary` (string) but the form has no field for it. |
| 4-9 | N/A | Blocked by D-ACCOM.1. |

## Findings

### D-ACCOM.1 🔴 CRITICAL — Create rejected with 400 because schema requires `summary` field that is NOT in the form (schema/form mismatch family)

- **Symptom:** `POST /api/v1/admin/accommodations` returns
  `400 { error: { code: "VALIDATION_ERROR", details: [{ field: "summary", code: "INVALID_TYPE", zodMessage: "Invalid input: expected string, received undefined" }] } }`.
  Form payload sent was `{ name, description, address, city, country, state, type, destinationId, ownerId }`. No `summary` key is included because the create form does NOT expose a `summary` field.
- **Console evidence:**
  - `[ADMIN] Failed to create accommodation ApiError: Request failed (400)`
  - `Translation key not found: validationError.field.invalidType`
  - `[ADMIN] Error field "summary" not found in DOM`
- **Pattern:** **same family as D-USERS.4** (user edit was rejected because schema required `authProviderUserId` but form didn't have it). The bug is the schema asking for a field the create form doesn't render. Either the schema should make `summary` optional in admin create, or the create form needs to add a `summary` field (likely a short text/textarea distinct from `description`).
- **Files to investigate:**
  - `packages/schemas/src/entities/accommodation/accommodation.create.schema.ts` (or wherever the admin POST input shape lives) — check if `summary` should be `.optional()` or `.default('')`.
  - `apps/admin/src/features/accommodations/config/sections/basic-info.consolidated.ts` — add a `summary` field (the spec's i18n keys already exist: `fields.accommodation.summary.label/description/placeholder`).
- **Acceptance:** create succeeds with a minimal payload (or the form exposes a working Summary field).
- **Triage:** in-scope per spec §5 risk rule — this is data-layer/lifecycle (Create flow is broken end-to-end).

### D-ACCOM.2 🟡 MED — Hydration mismatch on mainImage input (SSR vs client random uuid)

- **Symptom:** React hydration error logged on first page render:
  `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties` — diff is on the `<input type="file" id="input-{uuid}">` inside ImageField. Server-rendered uuid differs from client-generated one.
- **Surface:** `/accommodations/new` Gallery section, "Imagen Principal" file input. Likely also affects every form with an `ImageField`.
- **Suspected root cause:** `ImageField.tsx` uses `crypto.randomUUID()` or `useId()` incorrectly — the uuid is generated at render time without being seeded to the same value across SSR and client.
- **Fix direction:** use React's `useId()` hook (deterministic across SSR/client) or derive the id from a stable field config key.
- **Impact:** cosmetic in console; the file input still works because hydration mismatch warnings are non-fatal in current React. Out of scope for a Phase 6 blocker but worth filing.

### D-ACCOM.3 🟡 MED — `destinationId` shown as not-required in form even though config says `required: true`

- **Symptom:** the Destino combo button has `aria-required` not set / `required: false` even though `basic-info.consolidated.ts:113` declares `required: true`. (Verified by reading `field-destinationId` element attrs from devtools.)
- **Suspected root cause:** the `EntitySelectField` only forwards `required` to the visible Label asterisk (via `cn(..., required && 'after:content-["*"]')` line 401), not to the trigger button's `aria-required`.
- **Fix direction:** add `aria-required={required}` to the PopoverTrigger Button in `EntitySelectField.tsx:425-446`. Same for `DestinationSelectField`.
- **Severity:** accessibility / form-validation hint only; not blocking.

## Phase 6 emerging pattern (schema/form mismatch family)

Three smokes have now produced the same class of bug:

| Entity | Op | Field missing from form | Required by schema | Symptom |
|--------|----|---|---|---|
| users  | EDIT  | `authProviderUserId` | yes | client-side Zod rejects (D-USERS.4) |
| accommodations | CREATE | `summary`            | yes | server 400 (D-ACCOM.1) |
| (events / event-organizers from previous session) | CREATE | various nested fields | yes | (folded into D-2.1 fix, now unblocked) |

These belong to **a single root-cause family**: the admin schemas (`@repo/schemas`) drift relative to what the admin forms actually expose. Probably a follow-up sweep is needed: for every entity, audit `create.schema.ts` + `update.schema.ts` vs the consolidated form config, and either make the missing fields `.optional()` or surface them in the form. Out-of-scope for individual smoke fixes, in-scope for a Phase 6 triage decision.

# CRUD smoke — events (D-3)

- **Date**: 2026-05-14
- **Operator**: <superadmin@hospeda.com>
- **Marker**: SMOKE-2026-05-14-event
- **Outcome**: 🔴 **FAIL at step 2 — cannot create event**

## Steps

| # | Step | Result | Notes |
|---|------|--------|-------|
| 1 | List baseline | ✅ | 15 rows visible, GET `/api/v1/admin/events?page=1&pageSize=15` → 200, headers in English (I-5 confirmed) |
| 2 | Create | 🔴 BLOCKED | Cannot fill required date field `field-date.start`; same root cause as D-2.1 |
| 3-9 | … | ⏭ N/A | Blocked by step 2 |

## Findings

### D-3.1 🔴 CRITICAL — Same root cause as D-2.1

`field-date.start` (required, datetime input) does not accept input through `fill`, programmatic
setter, or simulated keystrokes. Pattern matches D-2.1 exactly. **Confirms**: the bug is NOT
specific to Location — it affects every form input whose `id` uses dot notation (`field-X.Y`).

Forms-on-events confirmed-blocked-by-pattern (smoke can NOT proceed without manual UI):

- `field-date.start`, `field-date.end` — Fecha y Precios section
- `field-pricing.price`
- `field-contact.email`, `field-contact.phone`, `field-contact.website`

Forms-on-events that work (flat ids):

- `field-name`, `field-slug`, `field-summary`, `field-description`

→ **Promote D-2.1 from a "destinations Location bug" to a cross-cutting bug** affecting every
entity with nested fields. New name suggestion: **D-X.1 (cross-cutting)**.

### D-3.2 🟡 MEDIUM — I-5 confirmed on `/events` columns

Headers: `Name | Category | Organizer | Start Date | Location | Price | Featured | Visibility | Created`. All English.

## Console errors during this smoke

None.

## Next action

Same as D-2.1 — fix the dot-notation field controller; this single fix unblocks events,
destinations, and probably accommodations + sponsors + posts.

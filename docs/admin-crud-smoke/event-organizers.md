# CRUD smoke — event-organizers (D-5)

- **Date**: 2026-05-14
- **Operator**: <superadmin@hospeda.com>
- **Marker**: SMOKE-2026-05-14-evtorg
- **Outcome**: 🔴 **FAIL at step 2 — required `field-contactInfo.mobilePhone` is dot-notation**

## Steps

| # | Step | Result | Notes |
|---|------|--------|-------|
| 1 | List baseline | ✅ | 5 rows visible. |
| 2 | Create | 🔴 | Required `field-contactInfo.mobilePhone` blocked by D-2.1 (cannot accept input). All `contactInfo.*` and `socialNetworks.*` fields are dot-notation. |
| 3-9 | … | ⏭ N/A | Blocked. |

## Findings

### D-5.1 (CONFIRMS D-2.1) — `event-organizers/new` form has 12 dot-notation fields, all blocked

Field ids inventory:

- Flat (work): `field-name`, `field-slug`, `field-description`
- Dot-notation (BLOCKED): `field-contactInfo.personalEmail`, `field-contactInfo.workEmail`,
  `field-contactInfo.mobilePhone` **(required)**, `field-contactInfo.homePhone`,
  `field-contactInfo.workPhone`, `field-contactInfo.website`, `field-socialNetworks.facebook`,
  `field-socialNetworks.instagram`, `field-socialNetworks.twitter`, `field-socialNetworks.linkedIn`,
  `field-socialNetworks.youtube`, `field-socialNetworks.tiktok`.

Same single root cause as D-2.1 / D-3.1.

### D-5.2 (CONFIRMS I-1) — `Nuevo {entity} Organizador` placeholder leak

## Console errors during this smoke

None.

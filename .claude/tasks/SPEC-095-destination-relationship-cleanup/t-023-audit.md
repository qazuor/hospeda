# T-023 — Seed Audit Report

**Date:** 2026-04-27
**Status:** completed (audit only, no code changes)
**Next:** T-024 (re-seed implementation)

---

## Destination Seeds (reference table)

26 destination seeds, of which 22 are CITY type and 4 are higher-level
(COUNTRY, REGION, PROVINCE, DEPARTMENT).

| ID | Type | Notes |
|---|---|---|
| `001-destination-chajari` | CITY | |
| `002-destination-colon` | CITY | |
| `003-destination-concordia` | CITY | |
| `004-destination-federacion` | CITY | |
| `005-destination-gualeguaychu` | CITY | |
| `006-destination-ibicuy` | CITY | |
| `007-destination-liebig` | CITY | |
| `008-destination-paranacito` | CITY | |
| `009-destination-san-jose` | CITY | |
| `010-destination-ubajay` | CITY | |
| `011-destination-concepcion-del-uruguay` | CITY | |
| `012-destination-santa-ana` | CITY | |
| `013-destination-san-salvador` | CITY | |
| `014-destination-villaguay` | CITY | |
| `015-destination-villa-elisa` | CITY | |
| `016-destination-rosario-del-tala` | CITY | |
| `017-destination-san-justo` | CITY | |
| `018-destination-caseros` | CITY | |
| `019-destination-urdinarrain` | CITY | |
| `020-destination-larroque` | CITY | |
| `021-destination-gualeguay` | CITY | |
| `022-destination-ceibas` | CITY | |
| `100-destination-argentina` | COUNTRY | not usable as `destinationId` for accommodations/eventLocations |
| `101-destination-litoral` | REGION | not usable |
| `102-destination-entre-rios` | PROVINCE | not usable |
| `103-destination-departamento-uruguay` | DEPARTMENT | not usable |

---

## Accommodation Seeds — Findings

**Total files:** 104 (`packages/seed/src/data/accommodation/**/*.json`)

### destinationId integrity

- ✅ **104/104 reference an existing destination seed**
- ✅ **104/104 reference a CITY-typed destination**
- 🟢 No remapping needed for `destinationId`.

### Stale `location.*` keys

- ❌ **104/104 still carry stale `location.{city,state,country,zipCode,neighborhood}` keys**
- These are no longer part of `AccommodationLocationSchema` (postal-only after SPEC-095 T-001).
- Must be stripped in T-024. Keys observed: `city`, `state`, `country`, `zipCode`, `neighborhood`.
- No `department` keys present in accommodation seeds.

**Action for T-024:** strip the five stale keys from the `location` block of every accommodation seed file.

---

## EventLocation Seeds — Findings

**Total files:** 6 (`packages/seed/src/data/eventLocation/*.json`)

### destinationId integrity

- ❌ **6/6 are missing `destinationId` entirely** (legacy flat shape, pre-SPEC-095)
- ❌ **6/6 carry root-level `city`, `state`, `country`, `zipCode`, `neighborhood` fields** (must be stripped)
- ⚠️ The new schema (`EventLocationAddressSchema`) requires:
  - `destinationId` (CITY-typed FK) at the root
  - postal fields kept at the root: `coordinates`, `street`, `number`, `floor`, `apartment`, `placeName`
  - geographic fields removed

### Required mapping

| File | Source `city` | Target `destinationId` | Existing destination seed? |
|---|---|---|---|
| `001-eventLocation-colon-anfiteatro-colon.json` | Colón | `002-destination-colon` | ✅ |
| `002-eventLocation-federacion-complejo-termal-federacion.json` | Federación | `004-destination-federacion` | ✅ |
| `003-eventLocation-gualeguaychu-corsodromo-gualeguaychu.json` | Gualeguaychú | `005-destination-gualeguaychu` | ✅ |
| `004-eventLocation-concepcion-del-uruguay-palacio-san-jose.json` | Concepción del Uruguay | `011-destination-concepcion-del-uruguay` | ✅ |
| `005-eventLocation-victoria-puerto-victoria.json` | Victoria | **NEW** `023-destination-victoria` | ❌ — needs new seed |
| `006-eventLocation-concordia-teatro-pedro-barbero.json` | Concordia | `003-destination-concordia` | ✅ |

**Action for T-024:**

1. Create `packages/seed/src/data/destination/023-destination-victoria.json` (Victoria, Entre Ríos — CITY).
2. For each of the 6 eventLocation seeds:
   - Remove root keys `city`, `state`, `country`, `zipCode`, `neighborhood`.
   - Add `destinationId` per the mapping table above.
   - Keep `street`, `number`, `coordinates`, `placeName`, `slug`, `id`, `lifecycleState`.

---

## Summary

| Entity | Files | destinationId remap | Stale-key strip | New destination needed |
|---|---|---|---|---|
| accommodation | 104 | 0 | 104 | 0 |
| eventLocation | 6 | 6 (add fresh) | 6 | 1 (Victoria) |

**Total touched in T-024:** 104 accommodations + 6 eventLocations + 1 new destination = 111 files.

---

## Verification command after T-024

```bash
pnpm db:fresh-dev
# Expected: zero VALIDATION_ERROR rows in seed log; accommodation + eventLocation seeded successfully.
```

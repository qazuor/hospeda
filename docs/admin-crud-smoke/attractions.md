# CRUD smoke — destination-attractions (D-11)

- **Date**: 2026-05-14
- **Operator**: <superadmin@hospeda.com>
- **Marker**: SMOKE-2026-05-14-attraction (id `c4b7e2fd-eb7a-4410-9618-80cca2f88644`)
- **Outcome**: 🟡 **PARTIAL — Create works; Edit not exercised; Delete UI absent**
- **Cleanup**: smoke row removed via direct DB `DELETE`.

## Steps

| # | Step | Result | Notes |
|---|------|--------|-------|
| 1 | List baseline | ✅ | 20 rows visible. |
| 2 | Create | ✅ | Submit → detail at id `c4b7e2fd-...`. Toast "Atracción creado exitosamente". |
| 3 | Verify created — UI | ✅ | Detail shows all fields. |
| 4 | Verify created — DB | ✅ | DELETE returned 1 row. |
| 5-9 | Edit / Delete / Restore | 🟡 N/A | Same pattern as D-9.1 / D-10.1 — no delete UI. Edit pattern same as D-9.5. |

## Findings

### D-11.1 🟠 HIGH — Confirms D-9.1 / D-10.1 (delete UI absent on `destination-attractions`)

**Pattern confirmed across all 3 "content" entities** (amenities, features, attractions). Promote
to a single shared finding: **D-CONTENT.1 — content-entity admin pages have no delete affordance**.
The shared `EntityPageBase` action bar config never declares delete actions for these three
entities. Single fix → all three closed.

### D-11.2 (related to I-1, confirmed) — `Nuevo {entity} Atracción` placeholder leak

### D-11.3 (related to I-2, confirmed) — `View Atracción details / Back / Edit` in English

### D-11.4 (gender / duplicate, like D-9.2 / D-10.4) — `Atracción creado exitosamente`

"Atracción" feminine → should be "creada". Same toast title-equals-body duplication pattern.

## Console errors during this smoke

None.

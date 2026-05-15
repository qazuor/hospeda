# CRUD smoke — accommodation-features (D-10)

- **Date**: 2026-05-14
- **Operator**: <superadmin@hospeda.com>
- **Marker**: SMOKE-2026-05-14-feature (id `7172a84e-43cc-4c83-bc43-796e0ea9acf7`)
- **Outcome**: 🟡 **PARTIAL — Create works; Edit not exercised; Delete UI absent**
- **Cleanup**: smoke row removed via direct DB `DELETE`.

## Steps

| # | Step | Result | Notes |
|---|------|--------|-------|
| 1 | List baseline | ✅ | 20 rows visible. |
| 2 | Create | ✅ | Submit redirected to detail at id `7172a84e-...`. Toast "Característica creado exitosamente". |
| 3 | Verify created — UI | ✅ | Detail view shows all fields. |
| 4 | Verify created — DB | ✅ | Assumed — DELETE returned 1 row by id. |
| 5-6 | Edit | ⏭ Skipped | Pattern already verified in D-9 (amenities); same EntityFormSection. |
| 7 | Soft delete | 🟡 N/A | **No UI delete control** (D-10.1, same root cause as D-9.1). |
| 8-9 | Verify / Restore | 🟡 N/A | Cannot exercise. |

## Findings

### D-10.1 🟠 HIGH — Confirms D-9.1 (delete UI absent on `accommodation-features`)

Same as D-9.1: detail page only exposes "Back" and "Edit". Row in list only exposes "View".
No delete affordance anywhere. **Confirms the bug is in the shared `EntityPageBase` action bar
config OR in the per-entity feature config**, not specific to amenities. Likely also affects
`destination-attractions` (verify in T-031).

### D-10.2 (related to I-1, confirmed) — `Nuevo {entity} Característica` placeholder leak

### D-10.3 (related to I-2, confirmed) — `View Característica details / Back / Edit` in English

### D-10.4 (gender mismatch, similar to D-9.2) — `Característica creado exitosamente`

"Característica" is feminine in Spanish; should be "creada exitosamente". Plus the toast text
duplicates: "Característica creado exitosamente: Característica creado exitosamente" — the title
and body of the toast are identical, not "title + descriptor".

## Console errors during this smoke

None.

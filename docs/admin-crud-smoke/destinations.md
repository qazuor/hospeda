# CRUD smoke — destinations (D-2)

- **Date**: 2026-05-14
- **Operator**: <superadmin@hospeda.com>
- **Marker**: SMOKE-2026-05-14-dest
- **Outcome**: 🔴 **FAIL at step 2 — cannot create destination**

## Steps

| # | Step | Result | Notes |
|---|------|--------|-------|
| 1 | List baseline | ✅ | 10 rows visible (default `destinationType=CITY` filter), pagination "Página 1 de 3", 0 console errors, GET `/api/v1/admin/destinations?page=1&pageSize=10&destinationType=CITY` → 200 |
| 2 | Create | 🔴 BLOCKED | Cannot fill required Location fields (see D-2.1). Form cannot reach submit. |
| 3 | Verify created — UI | ⏭ N/A | Blocked by step 2 |
| 4 | Verify created — DB | ⏭ N/A | Blocked by step 2 |
| 5 | Edit | ⏭ N/A | Blocked by step 2 (no row to edit) |
| 6 | Verify edit | ⏭ N/A | Blocked by step 2 |
| 7 | Soft delete | ⏭ N/A | Blocked by step 2 |
| 8 | Verify soft delete | ⏭ N/A | Blocked by step 2 |
| 9 | Restore | ⏭ N/A | Blocked by step 2 |

## Findings

### D-2.1 🔴 CRITICAL — `/destinations/new` Location fields are write-protected

The Location section's required fields (`field-location.country`, `field-location.state`, plus
optional `field-location.city`, `field-location.zipCode`, `field-location.coordinates.lat`,
`field-location.coordinates.long`) **do not accept input** through any tested mechanism:

- Chrome DevTools `fill` tool: reports success but `el.value === ""`.
- Programmatic `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set` +
  `dispatchEvent('input'/'change'/'blur')`: same outcome (`el.value === ""`).
- Native focus + simulated `type_text` (real keystrokes): same outcome (`el.value === ""`).

The "Other" textbox fields in the same form (`field-name`, `field-slug`, `field-summary`,
`field-description`) accept input fine, so the issue is **scoped to the Location section**.

The form cannot be submitted because `País*` and `Provincia/Estado*` are required and remain
empty. Result: **destinations cannot be created from the admin UI**.

- **Suspected root cause**: the Location field group is wrapped in a custom controller (likely
  a coordinate / geocoding component, or a TanStack Form `Field` subscriber pattern with
  explicit `value`/`onChange` from `@tanstack/react-form`). The wrapper either:
  1. Ignores DOM input events and only updates from a programmatic source (e.g. a map picker,
     a geocoding autocomplete callback).
  2. Resets the value on every render via stale-state binding.
  3. Has the input behind a `pointer-events: none` overlay (less likely — focus succeeds).
- **File suspects**: `apps/admin/src/features/destinations/config/sections/basic-info.consolidated.ts`
  (location field definitions) and the shared `EntityFormField` / `LocationSelect` /
  `CoordinatesInput` components in `apps/admin/src/components/entity-form/` and
  `apps/admin/src/components/selects/`.
- **Fix direction**: locate the wrapper and verify its `onChange` handler updates RHF state.
  If a geocoder is intended, it must still allow manual typing as a fallback.
- **Acceptance**: typing into País / Provincia / Ciudad reflects in `el.value` and persists
  through submission.

### D-2.2 🟠 HIGH — Form loses unsaved input when focus moves to a `<combobox>`

When typing into a non-Location textbox (e.g. `field-description` or `field-summary`) and then
clicking a combobox (e.g. "Tipo de Destino" or "Visibilidad") **without first blurring the
textbox**, the textbox value is **discarded** on the re-render that follows the combobox open.

- **Reproduction**: Type into `Resumen` (a multiline textarea) → without tabbing or clicking
  away, click the `Visibilidad` combobox → check `Resumen` value: was reset to `""`.
- **Suspected root cause**: the consolidated form uses controlled inputs whose `value` prop is
  bound to an RHF controller, but the controller only `setValue` on `blur`, not on `change`.
  When the combobox-click triggers a re-render, the controlled input re-mounts with the stale
  empty form state.
- **Fix direction**: switch the textbox controller to `setValue` on every `onChange` (not just
  `onBlur`), or preserve the in-progress value in local component state until `onBlur`.
- **Acceptance**: clicking any combobox preserves all in-progress textbox values.

### D-2.3 🟡 MEDIUM — Enum dropdown values render in English (already covered by I-* family)

- The `Visibilidad` combobox shows `Public / Private / Restricted` (English).
- The `Tipo de Destino` combobox shows Spanish values (`País / Región / Provincia / Departamento /
  Ciudad / Pueblo / Barrio`) — correctly localized.
- The inconsistency confirms that **enum value localization is per-field, not centralized**.
  Add a shared `t('common.enums.visibility.PUBLIC')` etc. and make every enum combobox use it.
- Belongs to the I-* category as a new finding I-6 (or as an extension of I-3/I-4). Cross-ref
  noted here for the spec update at T-037.

### D-2.4 🟡 MEDIUM — Confirms previously-known I-1 (`{entity}` placeholder leak)

Heading shows `Nuevo {entity} Destino`. Already tracked as I-1. No new info.

### D-2.5 🟡 MEDIUM — Confirms previously-known I-5 (English column headers)

`/destinations` list table headers: `Name | Accommodations | Attractions | Rating | Reviews |
Featured | Visibility | Created`. Already tracked as I-5. No new info.

## Console errors during this smoke

None during steps 1-2. (No `Failed to load resource`, no React warnings.) Network panel clean
on the list view; only the GET to `/api/v1/admin/destinations` was observed.

## Next action

Block D-2 from running steps 3-9 until D-2.1 is fixed. The fix-investigation can run in
parallel with other smokes (T-025 events, T-026 event-locations, etc.).

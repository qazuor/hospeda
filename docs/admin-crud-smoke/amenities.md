# CRUD smoke — accommodation-amenities (D-9)

- **Date**: 2026-05-14
- **Operator**: <superadmin@hospeda.com>
- **Marker**: SMOKE-2026-05-14-amenity (id `fd50a741-04bb-4d34-8fd7-91646daa22fb`)
- **Outcome**: 🟡 **PARTIAL — Create + Edit work; Delete UI is absent**
- **Cleanup**: smoke row removed via direct DB `DELETE` after smoke completed.

## Steps

| # | Step | Result | Notes |
|---|------|--------|-------|
| 1 | List baseline | ✅ | 20 rows visible. GET `/api/v1/admin/amenities?...` → 200. |
| 2 | Create | ✅ | Submit redirected to `/content/accommodation-amenities/<id>`. Toast "Comodidad creado exitosamente". |
| 3 | Verify created — UI | ✅ | Detail view shows all fields correctly: name, slug, description, icon, displayWeight, type=Conectividad, lifecycle=Activo. |
| 4 | Verify created — DB | ✅ | `amenities` row exists: `type=CONNECTIVITY`, `lifecycle_state=ACTIVE`, `deleted_at=NULL`, `created_at` recent. |
| 5 | Edit | ✅ | Edit page loaded, name changed to `-EDIT` suffix, submit redirected back to detail. Toast "Guardado exitoso". |
| 6 | Verify edit — UI + DB | ✅ | Detail header shows new name. (DB updated_at not separately verified; UI is source of truth here.) |
| 7 | Soft delete | 🟡 N/A | **No UI delete control on the row OR on the detail page.** See D-9.1. |
| 8 | Verify soft delete | 🟡 N/A | Cannot exercise. |
| 9 | Restore | 🟡 N/A | Cannot exercise. |

## Findings

### D-9.1 🟠 HIGH — `accommodation-amenities` exposes no delete UI (list row OR detail page)

The list `/content/accommodation-amenities` shows only a "View amenity" button per row.
The detail page `/content/accommodation-amenities/{id}` exposes only "Back" and "Edit" buttons.
There is no "Eliminar" / "Borrar" / kebab-menu / row-action affordance anywhere in the smoke
path. Operator cannot remove a created amenity through the admin UI — only via direct DB access.

- **Suspected root cause**: the entity-config for amenities (`apps/admin/src/features/amenities/`)
  does not declare `delete` actions on its row config or detail action bar.
- **Fix direction**: add a "Eliminar" action button on the detail page (with confirmation dialog)
  AND a row action in the list table. The delete should call the existing
  `DELETE /api/v1/admin/amenities/{id}` endpoint (likely soft-delete since `amenities` table has
  `deleted_at` per the seed schema).
- **Acceptance**: a SUPER_ADMIN can soft-delete an amenity from the UI; the row disappears from
  default list filter, reappears with "Mostrar eliminados", and Restore brings it back.

### D-9.2 🟢 LOW — Toast wording: "Comodidad **creado** exitosamente" (gender mismatch)

The success toast on Create says "Comodidad creado exitosamente" — "Comodidad" is feminine in
Spanish, so it should be "Comodidad **creada** exitosamente". Same likely applies to Edit /
Delete toasts (although Edit toast is generic: "Guardado exitoso: Los cambios se guardaron
correctamente"). Also note that the entity name flips between "Comodidad" (singular Spanish
feminine) on this toast and "Amenidad" (Spanish menu label) and "Amenities" (English schema name).
Pick one convention and apply it everywhere.

### D-9.3 🟢 LOW — Submit dispatches `Crear Comodidad` despite the page label being "Amenidad"

Same naming inconsistency as D-9.2 — the create button is labelled "Crear Comodidad" but the menu
nav label and breadcrumb say "Amenidad" / "Amenidades". Cosmetic but jarring.

### D-9.4 (related to I-1, confirmed) — `Nuevo {entity} Comodidad` placeholder leak in heading

### D-9.5 (related to I-2, confirmed) — Detail header reads `View Amenidad details / Back / Edit` (English) on the Spanish-locale page

### D-9.6 (related to V — needs visual review) — `field-displayWeight` accepts free text including non-numeric input

The "Peso de Visualización" field is documented as "1-100" but rendered as `<input type="text">`
not `type="number"`. This smoke filled it with `50` (valid) but no client-side validation
enforces the documented range. Server-side validation may catch it but the UI gives no feedback.
Promote to V-* if visual sweep confirms the field has no helper-text constraint UI.

## Console errors during this smoke

None.

## Next action

Same as D-2.1 / D-3.1 (cross-cutting) — but D-9.1 is a NEW finding specific to the amenities
config (no shared root cause with the dot-notation form bug). Likely also affects features (D-10)
and attractions (D-11) since the three "content" entities share the same structure. Verify in
T-030 + T-031 smokes.

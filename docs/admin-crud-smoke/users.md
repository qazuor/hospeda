# CRUD smoke — users (D-7)

- **Date:** 2026-05-15
- **Operator:** <superadmin@hospeda.com> (SUPER_ADMIN)
- **Marker:** `smoke-2026-05-15-users`
- **Test row id:** `7e426a3b-3ccc-45bd-ae07-af7b454f572a`
- **Branch:** `fix/admin-pages-audit`

| Step | Result | Notes |
|------|--------|-------|
| 1 List baseline | ✅ | 22 users page 1, page 2 follows. Console clean. `GET /api/v1/admin/users` → 200. |
| 2 Create form fields | ✅ | 6 fields (displayName, slug, firstName, lastName, email, role). No nested. No password (Better Auth handles credentials). |
| 3 Submit create | ✅ | `POST /api/v1/admin/users` → 201. Redirect to `/access/users/{uuid}`. |
| 4 Verify create — UI | ✅ | Detail page renders all values + tabs (Perfil / Permisos / Actividad). |
| 5 Verify create — DB | ✅ | Row in `users` table: role=USER, visibility=PUBLIC, lifecycle_state=ACTIVE, deleted_at=NULL. |
| 6 Edit form loads | ✅ | Edit page hydrates with values. 4 sections (Información Básica 4/5, Contacto 1/2, Rol y Permisos 1/1, Estados 2/2). Adds 2 fields not in Create form (Fecha de Nacimiento, Sitio Web) plus Visibilidad + Estado de Cuenta. |
| 6b Edit submit | 🔴 | **D-USERS.4 below.** Submit click does NOT trigger network request. Form save error in console: `Translation key not found: Invalid input: expected string, received null` + `Error field "authProviderUserId" not found in DOM`. DB row `last_name` unchanged, `updated_at == created_at`. |
| 7 Soft delete UI | 🔴 | **D-USERS.5 below.** No "Eliminar" / "Archivar" button anywhere — neither in list row actions (only "View" + "Suplantar") nor in detail action bar (only "Volver" + "Editar"). |
| 8-9 Soft-delete verify / Restore | N/A | Blocked by D-USERS.5. |

## Findings

### D-USERS.1 🟠 HIGH — Multiple i18n MISSING keys on list

- **Symptom:** rendered `[MISSING: ...]` placeholders on list table:
  - `admin-entities.columns.fullName` (column header)
  - `admin-entities.types.userRole.{system,admin,editor,host,user,guest}` (6 role badges)
  - `admin-entities.types.authProvider.betterAuth` (auth provider badge)
- **Surface:** `/access/users` list, all rows.
- **Fix direction:** add the 8 missing keys to `packages/i18n/src/locales/{es,en,pt}/admin-entities.json`. Also confirm whether `fullName` should map to existing `firstName + lastName` rendering.

### D-USERS.2 🟡 MED — No edit affordance from list row

- **Symptom:** list row actions show only `View user` (eye icon) + `Suplantar usuario` (user-switch icon). No edit button. Operator must drill into detail before reaching edit.
- **Pattern:** common UX miss for admin tables. Not blocking but adds friction.
- **Fix direction:** add an "Edit" row action that links to `$id/edit`.

### D-USERS.3 🟡 MED — Detail + edit show enum values in English

- **Symptom:** detail page displays `Visibilidad: Public` and `Estado de Cuenta: Active` (English). Edit combobox values are also `Public` / `Active`.
- **Surface:** `/access/users/{id}` and `/access/users/{id}/edit`.
- **Suspected root cause:** enum value mapping not running through i18n keys (similar to D-DROPDOWN.1 already filed on destinations Visibilidad combo).
- **Fix direction:** route enum labels through `common.enums.lifecycleState.*` and `common.enums.visibility.*` keys. Folds into the same sweep as D-DROPDOWN.1.

### D-USERS.4 🔴 CRITICAL — Edit submit silently rejected by client-side Zod validation on non-form field `authProviderUserId`

- **Symptom:** clicking "Guardar cambios" on `/access/users/{id}/edit` shows no toast,
  performs no network request, and DB row is unchanged. `updated_at == created_at`,
  edited `lastName` ("User-EDIT") was not persisted.
- **Console evidence:**
  - `[ADMIN] Form save error: Error: La validación del formulario falló.`
  - `[ADMIN] Error field "authProviderUserId" not found in DOM`
  - `Translation key not found: Invalid input: expected string, received null`
- **Root cause hypothesis:** the user edit Zod schema treats `authProviderUserId` as
  a required string, but (a) the DB column is nullable text and (b) the edit form
  has NO field for it, so the form values pass `authProviderUserId = null/undefined`
  through to `validateFormWithZod`, which rejects with "expected string, received null".
- **Why no user-facing toast was visible:** `EntityEditContent.handleSave` catch
  branch does call `addToast({ variant: 'error', ... })`, but it depends on
  `parseApiValidationErrors` parsing an API-shaped error envelope (`error.body`).
  Here the error originates client-side (Zod), so `error.body` is undefined,
  `fieldErrors` stays empty, and the error message falls through to
  `t('error.form.unexpected-error')`. Either the toast is being clobbered by a
  later render or the message lookup is also failing (the "Translation key not
  found: Invalid input..." console line suggests so).
- **Files to investigate:**
  - `packages/schemas/src/entities/user/user.update.schema.ts` (or wherever the
      admin update payload schema lives) — confirm `authProviderUserId` should
      be `.optional().nullable()` to match DB nullability.
  - `apps/admin/src/features/access/users/config/sections/...` — if the field
      should be editable, add it; if not, the schema must allow it absent.
  - `apps/admin/src/components/entity-pages/EntityEditContent.tsx:97-135` —
      improve the toast fallback for client-side validation errors so silent
      failures are impossible.
- **Acceptance:** editing `last_name` and saving updates the DB row and
  `updated_at`, shows a green toast, and redirects (or stays on edit with a
  green toast — match the pattern of other entities).

### D-USERS.5 🟠 HIGH — No delete / archive UI on users list or detail (D-CONTENT.1 surface)

- **Symptom:** no way to soft-delete or archive a user from the admin UI. Buttons
  exist in list rows (View + Suplantar) and detail (Back + Edit) but no Eliminar /
  Archivar action.
- **Surface:** `/access/users` and `/access/users/{id}`.
- **Suspected root cause:** the entity config (`apps/admin/src/features/access/users/config/`)
  does not declare delete actions on the row config or the detail action bar.
- **Fix direction:** add a guarded "Eliminar" action (with confirmation dialog
  and SUPER_ADMIN-only gating). Calls existing `DELETE /api/v1/admin/users/{id}`.
  Reuse the row + action bar patterns from any entity that already has delete
  wired up (e.g., destinations, events).
- **Acceptance:** SUPER_ADMIN can soft-delete a non-system user from the list
  row or detail page; the row disappears from default list, reappears with
  "Mostrar eliminados", and `deleted_at IS NOT NULL` in DB.

## Pending follow-ups (not part of this smoke)

- Restore + view-deleted-users smoke deferred until D-USERS.5 fix lands.
- Edit smoke must be re-run after D-USERS.4 fix to confirm the actual edit flow
  (currently the form path is unreachable end-to-end).

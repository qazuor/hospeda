# CRUD smoke — tags-internal (D-12)

- **Date:** 2026-05-15
- **Operator:** <superadmin@hospeda.com> (SUPER_ADMIN)
- **Marker:** `SMOKE-2026-05-15-tag` / `SMOKE-2026-05-15-tag-EDIT`
- **Test row id:** `4be38bf0-5a6c-47dd-9cb2-24766513ee51` (deleted at end of smoke)
- **Branch:** `fix/admin-pages-audit`

> **Architecture note:** the three tag entities (`/tags/internal`, `/tags/post-tags`, `/tags/system`) use a **custom UI**, NOT `EntityCreateContent` / `EntityFormSection`. They have their own form components and their own list page. As a result they avoid the D-USERS.4 family of bugs (which are EntityFormProvider/Zod-schema specific), but they have their own bugs documented below. D-TAGS.1 and D-TAGS.2 apply to all three entities — verified by inspecting `/tags/post-tags` (34 rows) and `/tags/system` (67 rows) which share the same component family.

| Step | Result | Notes |
|------|--------|-------|
| 1 List baseline | ✅ | 67 internal tags page 1, 3 pages total. `GET /api/v1/admin/tags/internal` → 200. List has Edit + Delete row actions (unlike users/D-USERS.5). |
| 2 Create form | ✅ | Custom form with Nombre / Color combo (Spanish enum labels) / Icono / Descripción / Estado (default Activo). |
| 3 Submit create | ✅ | Redirect to list. `POST /api/v1/admin/tags/internal` → 201. |
| 4 Verify create — DB | ✅ | Row in `tags` table: name=`SMOKE-2026-05-15-tag`, color=BLUE, type=INTERNAL, lifecycle_state=ACTIVE, deleted_at=NULL. |
| 5 Edit form loads | ✅ | Edit page hydrates with values. |
| 6 Edit submit | ✅ | `PATCH /api/v1/admin/tags/internal/{id}` → 200. DB `name` changed to `SMOKE-2026-05-15-tag-EDIT`, `updated_at > created_at`. **Edit path works** — unlike users (D-USERS.4) where the EntityFormProvider Zod validation silently fails. |
| 6b Filter by name | 🔴 | **D-TAGS.1 below.** Typing in "Filtrar por nombre" fires `GET /api/v1/admin/tags/internal?...&name=X` which returns `400 INVALID_PAGINATION_PARAMS` ("Invalid pagination parameters provided"). List shows "Error al cargar las etiquetas." |
| 7 Delete confirmation | ✅ | Clicking row's "Eliminar" opens a Radix AlertDialog: "Estás por eliminar permanentemente "..."... 0 entidades que la usan actualmente. Esta acción no se puede deshacer." |
| 8 Delete persists | ⚠️ | **D-TAGS.2 below.** Row is **HARD-DELETED** from DB (`SELECT ... WHERE id = ...` returns no rows). The dialog explicitly says "no se puede deshacer" so the behavior matches the UX promise, but it contradicts the standard pattern (soft-delete with `deleted_at`). The `tags` table HAS a `deleted_at` column that is never used. |
| 9 Restore | N/A | Not applicable — hard delete by design (per D-TAGS.2). |

## Findings

### D-TAGS.1 🔴 CRITICAL — Filter by name returns 400 INVALID_PAGINATION_PARAMS

- **Symptom:** typing anything in `Filtrar por nombre` triggers
  `GET /api/v1/admin/tags/internal?page=1&pageSize=25&name=X` which returns
  `400 { error: { code: "INVALID_PAGINATION_PARAMS", message: "Invalid pagination parameters provided" } }`. The list area shows `Error al cargar las etiquetas. Intentá de nuevo.`
- **Surface:** `/tags/internal`, `/tags/post-tags`, `/tags/system` — all three share the filter component.
- **Suspected root cause:** the admin route is built with `createAdminListRoute` (or similar) which rejects unknown query params (documented in CLAUDE.md). The filter component sends `name=X`, but the route's search schema only accepts a subset (likely `q`, `search`, or `nameSearch`). This is the same family as D-NEWSLETTER.* (T-013 / N-1 already fixed) where the client sent the wrong sort/filter param key.
- **Fix direction:** either (a) add `name` to the admin list search schema for tags, or (b) change the filter to send `q` / `search` (whichever the schema already accepts) and update the API to filter by name when that param is present. Verify in `apps/api/src/routes/admin/tags/internal/list.ts` and the corresponding admin search schema in `@repo/schemas`.
- **Acceptance:** typing in the filter narrows the list without error.

### D-TAGS.2 🟡 MED — Delete is hard-delete despite `tags.deleted_at` column existing (deviates from system soft-delete pattern)

- **Symptom:** clicking "Eliminar" on a row + confirming in the dialog issues a
  `DELETE /api/v1/admin/tags/internal/{id}` that **physically removes the row** from the DB. The `tags` table has a `deleted_at TIMESTAMP` column AND a `lifecycle_state` column — both standard soft-delete machinery — but neither is used. The confirmation dialog says "Esta acción no se puede deshacer", so the UX is honest about the destructive behavior.
- **Surface:** all three tags entities.
- **Product question (not a bug per se):** is hard-delete the intended behavior for tags, or is it a missed implementation of soft-delete? The standard system pattern (every other CRUD entity in the admin) is soft-delete with `deleted_at` + `lifecycle_state='ARCHIVED'` + a "Mostrar eliminados" filter to restore.
- **Fix direction:** either (a) switch the tags delete handler to soft-delete and add Mostrar Eliminados / Restaurar UI to the list, or (b) keep hard-delete and explicitly drop the `deleted_at` column from the schema to reflect reality. Recommend option (a) for consistency with the rest of the admin.

### D-TAGS.3 🟢 LOW — `?page=N` query param is not honored by the list page (suspected)

- **Symptom:** navigating to `/tags/internal?page=3` shows rows from page 1 but the paginator footer still reads "1 / 3". The page does paginate normally via the Siguiente / Anterior buttons (`?page=N` URL param is one of two possible state mechanisms — the page state appears to live in component state, not URL).
- **Severity:** very low; deep-linking to a page is a nice-to-have.

## Notes on tags-post-tags + tags-system

Spot-checked separately:

- `/tags/post-tags` → 34 tags, list loads clean, filter input present (will reproduce D-TAGS.1 if used), create link present.
- `/tags/system` → 67 tags, list loads clean, filter input present, create link present.

Both use the same custom component family as `/tags/internal`. Findings transfer wholesale. Full per-entity smokes (Create + Edit + Delete) are not run since (a) the code path is identical to the one validated above, (b) Create/Edit/Delete via the same UI in tags-internal already passed (with the two issues filed).

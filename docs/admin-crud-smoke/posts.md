# CRUD smoke — posts (D-6)

- **Date:** 2026-05-15
- **Operator:** <superadmin@hospeda.com> (SUPER_ADMIN)
- **Marker:** `SMOKE-2026-05-15-posts`
- **Test row id:** (not created — BLOCKED on Author required + EntitySelect bug)
- **Branch:** `fix/admin-pages-audit`

| Step | Result | Notes |
|------|--------|-------|
| 1 List baseline | ✅ | 15 posts page 1, page 2 follows. `GET /api/v1/admin/posts` → 200. |
| 2 Create — fill flat fields | ✅ | Title, slug, summary, category (combo "General") accepted. |
| 2b Create — RichText content | 🔴 | **D-POSTS.6 below.** RichText Contenido did not accept programmatic fill — char counter stayed at 0/50000. |
| 2c Create — Author select | 🔴 | **D-RELATIONS.1 below.** Author combo opens but listbox is empty — no fetch fired, no options rendered. Author is required → cannot submit. |
| 3-9 | N/A | Blocked by D-RELATIONS.1. |

## Findings

### D-POSTS.1 🟠 HIGH — i18n MISSING keys on list

- **Symptom:** rendered `[MISSING: ...]` placeholders on list table:
  - `admin-entities.columns.sponsorship`, `admin-entities.columns.sponsor` (column headers)
  - `admin-entities.types.postCategory.{general,rural,beach,family,traditions,nightlife,sport,art,festivals,culture,events,tips,history,nature,wellness}` (15 category badges)
- **Surface:** `/posts` list.
- **Fix direction:** add the 17 missing keys to `packages/i18n/src/locales/{es,en,pt}/admin-entities.json`.

### D-POSTS.2 🟡 MED — Boolean columns render `image "True"` / `image "False"` as label

- **Symptom:** column "Destacado" or "Noticia" renders icon with `image "True"` / `image "False"` accessibility label. Should be a checkmark/cross with localized label.
- **Surface:** `/posts` list.
- **Fix direction:** route the boolean → icon component through i18n keys for screen readers (e.g. `t('admin-common.boolean.true')` / `false`).

### D-POSTS.3 🟢 LOW — Header reads "Nuevo Publicación" instead of "Nueva Publicación"

- **Symptom:** create page header shows "Nuevo Publicación" — masculine "Nuevo" on feminine noun "Publicación". Same D-TOAST.2 family (gender mismatch).
- **Surface:** `/posts/new`.
- **Fix direction:** localize the "Nuevo X" template per-entity using gendered keys, or hardcode the correct article ("Nueva Publicación") in the posts feature config.

### D-POSTS.4 🟡 MED — Category combo options shown in English (D-DROPDOWN.1 surface)

- **Symptom:** 18 options of the Categoría combo (Events, Culture, Gastronomy, Nature, Tourism, General, Sport, Carnival, Nightlife, History, Traditions, Wellness, Family, Tips, Art, Beach, Rural, Festivals) all in English.
- **Surface:** `/posts/new` Categoría field.
- **Suspected root cause:** enum option labels hardcoded; same family as D-DROPDOWN.1 (destinations Visibilidad), D-USERS.3 (users Visibilidad/Estado de Cuenta).
- **Fix direction:** consolidated i18n sweep across all entity form combos. File together with D-DROPDOWN.1.

### D-POSTS.5 🔴 CRITICAL → folded into D-RELATIONS.1

The Author combo failing to load options was the trigger for the broader cross-cutting investigation that produced D-RELATIONS.1 (below). Keeping the cross-reference here so the audit trail is intact.

### D-POSTS.6 🟡 MED — RichText Contenido field rejects programmatic `fill`

- **Symptom:** the RichTextField (`field-content`) accepted neither chrome-devtools MCP `fill` nor a `setter.call(el, value)` + dispatched `input` event. Char counter stayed at `0/50000`.
- **Suspected root cause:** the RichText editor wraps a `contenteditable` div (Tiptap / similar). React-style input setters do not propagate to its internal state — it expects DOM-level keyboard events or a programmatic editor command.
- **Severity:** mostly a smoke-tooling limitation, not a real bug (a human typing manually would work). But it does mean (a) the create smoke for posts cannot be completed end-to-end via automated tooling, and (b) any future Playwright/Vitest e2e test must use editor-aware input helpers.
- **Acceptance:** manual operator typing in `field-content` reflects in the form state and counter; OR a smoke helper is documented that drives Tiptap via its command API.

### D-RELATIONS.1 🔴 CRITICAL — EntitySelect combos (Author, Location, Organizer, Destination, Accommodation, Event) open with empty listbox; no fetch ever fires (cross-cutting)

- **Symptom:** clicking any `EntitySelectField` / `UserSelectField` / `DestinationSelectField` combo (e.g. Autor on `/posts/new`, Ubicación / Organizador / Destino on `/events/new`) opens an empty Radix listbox. Network panel shows ZERO requests to the related-entity admin endpoint (`/api/v1/admin/users`, `/api/v1/admin/event-locations`, etc.) — neither at mount time nor on open.
- **Surface confirmed on:**
  - `/posts/new` → Autor (required), Destino Relacionado, Alojamiento Relacionado, Evento Relacionado
  - `/events/new` → Ubicación, Organizador, Destino
- **Surface predicted on:** `/accommodations/new` (owner + destination), `/billing/sponsorships/new` (sponsor + post), and any consolidated form with an entity relation.
- **Impact:** **BLOCKS** Create flow on every entity that has a required relation combo. The Posts smoke (T-033) cannot complete Step 2; the Events smoke (T-025, previously partially run) cannot pick a location/organizer; Accommodations smoke (T-035) is at risk for the same reason.
- **Suspected root cause:** the components in `apps/admin/src/components/entity-form/fields/EntitySelectField.tsx` (and per-entity wrappers `DestinationSelectField`, `UserSelectField`) likely gate their `useQuery` behind an `enabled` flag tied to the popover open state, but the open handler is not wired (or the query key never changes, so the cached "no data" result is reused). Less likely: the query runs at mount but the response is parsed wrong.
- **Files to investigate:**
  - `apps/admin/src/components/entity-form/fields/EntitySelectField.tsx`
  - `apps/admin/src/components/entity-form/fields/UserSelectField.tsx`
  - `apps/admin/src/components/entity-form/fields/DestinationSelectField.tsx`
  - `apps/admin/src/components/selects/*` (older shared select components)
  - The `createConsolidatedConfig` for posts and events — check the FieldTypeEnum used for those fields.
- **Fix direction:**
    1. Reproduce the empty listbox in dev tools, verify `useQuery` enabled flag + onOpenChange wire-up.
    2. Add a `onOpenChange={(open) => open && refetch()}` (or similar) on the Radix `Popover.Root` so the first open triggers the fetch.
    3. Add a loading state in the combo so the user sees "Cargando…" instead of an empty listbox.
- **Acceptance:** clicking the Autor combo on `/posts/new` opens a populated listbox with users (paginated or search-as-you-type). Network shows `GET /api/v1/admin/users?...` returning 200. Submitting a Post with Autor + min fields succeeds.

## Pending follow-ups

- Re-run posts CRUD smoke once D-RELATIONS.1 is fixed.
- Add a content-editor smoke helper for D-POSTS.6 so future automated runs can fill the RichText.

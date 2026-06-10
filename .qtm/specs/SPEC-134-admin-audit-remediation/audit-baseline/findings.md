# SPEC-131 — Admin App Audit Findings

- **Audit baseline SHA**: `1486e139d4a0e2f0d70900947c25a5ded87784e8`
- **Branch**: `spec/SPEC-131-admin-app-visual-functional-audit`
- **Audit started**: 2026-05-15
- **Scope**: Hybrid coverage — full responsive + axe-core (110 pages), critical-only visual+interaction + performance (30 pages). Keyboard nav skipped. See `pages-inventory.md` Scope Re-evaluation section.

> **Status**: Phase 5 aggregation COMPLETE (2026-05-16). All 31 findings catalogued. 105 pages successfully captured; 5 skipped for missing seed data. Phase 2 interactive-state capture deferred (visual review already extracted high-value findings). Phase 4 Lighthouse skipped per operator decision — can be added later for performance ranking.

---

## Summary table

| Severity | Visual | Interaction | A11y | Responsive | Performance | Total |
|---|---|---|---|---|---|---|
| blocker | 0 | 0 | 0 | 1 | — | 1 |
| critical (a11y) | — | — | 3 | — | — | 3 |
| high | 0 | 3 | 2 | 2 | — | 7 |
| medium | 2 | 1 | 4 | 2 | — | 9 |
| low | 1 | 0 | 1 | 1 | — | 3 |
| **Total** | **3** | **4** | **10** | **6** | **(pending)** | **23 + 8 partial-dup-skipped = 31 raised, 23 unique** |

Critical a11y findings have their own row because they correspond to axe `critical` impact rules (different rubric than "blocker": blocker = page unusable, critical-a11y = WCAG failure that excludes some users). Performance row pending Phase 4 (skipped per 2026-05-15 decision until further notice).

**Aggregated axe scale (re-run with content-loaded waits)**: 312 raw violations across 105 pages → **13 unique rules** → most traceable to ~6 shared components. The headline number is misleading; fixing a handful of components clears most of the report.

---

## Root-cause clusters (read this first — decision-ready view)

Many findings trace back to a small number of shared components. Fixing one root often clears multiple F-NNN entries. Use this to plan your fix PRs.

### Cluster 1 — Shared FormShell layout (the most expensive)

**Affected findings**: F-020 (blocker), partially F-018 (missing h1 on form pages)
**Root**: The shared form layout (sidebar with section-progress + form fields) does not have responsive breakpoints — uses fixed two-column grid at every viewport.
**Blast radius**: ~30 CREATE + EDIT pages across all entities. The biggest pain point in this audit by far.
**Suggested PR**: Single fix in the FormShell component → mobile becomes single-column with sidebar as a collapsible accordion. Likely also recovers some of the h1-missing issues if entity name is rendered in the sidebar today.
**Effort**: M

### Cluster 2 — Shared DataTable component (mobile + a11y)

**Affected findings**: F-014 (sort header contrast — 54 pages), F-021 (mobile column truncation — 30 pages), F-030 (users-specific duplicate columns)
**Root**: Shared DataTable component has weak mobile breakpoint behavior + sort-header button uses a low-contrast text token.
**Blast radius**: Every LIST page (30+ pages).
**Suggested PR**: One PR that (a) bumps sort-header text token to `text-foreground`, (b) adds `overflow-x-auto` wrapper with sticky first column OR auto-enables existing `Cuadrícula` view on mobile, (c) tells the users entity to drop the duplicate "Nombre Visible" column.
**Effort**: L

### Cluster 3 — Shared "Page sections" tab component (a11y critical)

**Affected findings**: F-011 (aria-required-children + aria-required-parent — both fire on the same broken element, 25 pages each)
**Root**: `role="tablist"` contains a wrapper div that breaks the direct-child relationship with `role="tab"` elements.
**Blast radius**: 25 entity VIEW/EDIT pages.
**Suggested PR**: Restructure the tabs component so tabs are direct children of the tablist. Move scroll-wrapper styling outside the tablist.
**Effort**: S

### Cluster 4 — Root layout / head metadata (a11y serious × many)

**Affected findings**: F-003 (missing `<title>` on 105 pages), F-013 (`<html lang="en">` for ES-default app)
**Root**: TanStack Start root head config in `__root.tsx` is incomplete (no `<title>`) and `<html lang>` is hardcoded.
**Blast radius**: All 105 captured pages.
**Suggested PR**: Add `<title>` via TanStack Start's `head` API in `__root.tsx`, with per-route head overrides for entity titles. Set `<html lang>` from current locale.
**Effort**: M (wiring per-route titles is the bulk of the work)

### Cluster 5 — Breadcrumb i18n + label resolution

**Affected findings**: F-025 (raw URL slug in breadcrumbs — billing/notifications), F-028 (notifications has English breadcrumb)
**Root**: Breadcrumb component falls back to slug → titleCase when no i18n key is registered for a route segment.
**Blast radius**: All `/billing/*` (10+ pages) + `/notifications`, possibly more not yet inventoried.
**Suggested PR**: Breadcrumb component reads i18n key map by route; add the missing keys for billing + notifications + any other affected segments.
**Effort**: S

### Cluster 6 — Form/filter accessibility (axe critical × few pages)

**Affected findings**: F-015 (combobox no name — 2 pages), F-016 (native select no label — 5 pages), F-017 (progressbar no name — 22 pages)
**Root**: Reusable form-control wrappers don't propagate accessible names to the underlying widget; FilterBar selects lack labels.
**Blast radius**: ~25 pages with various filter/progress widgets.
**Suggested PR**: Per-widget fix — likely 3 small PRs (one per affected primitive). Or a single PR that audits the shared form-control wrapper and ensures every widget has an accessible name path.
**Effort**: S each

### Cluster 7 — Misc visual polish (independent fixes)

**Affected findings**: F-029 (cron buttons too heavy), F-031 (dashboard sidebar gap), F-010 (role badges ES+EN mix), F-026 (English empty state), F-027 (English plan descriptions)
**Root**: Independent visual / i18n nits — no shared component to blame.
**Blast radius**: One page each.
**Suggested PR**: Either 5 tiny PRs or one bundled "admin polish" PR.
**Effort**: XS each

### Standalone (no cluster)

- **F-022** (gallery routing): single-file bug in `apps/admin/src/routes/_authed/accommodations/$id_.gallery.tsx`. Trivial fix once identified.
- **F-023** (sub-tab breadcrumbs): single shared layout fix; may also affect F-018 (missing h1).
- **F-024** (Zod errors leaked to UI): wrapping in user-friendly error in `/billing/plans` hook + a separate schema-alignment fix for the upstream API.
- **F-001** + **F-002** (auth): operator deferred to a separate session per 2026-05-15 conversation. Not actioned in this audit.



---

## Cross-cutting findings (root causes that manifest on many pages)

### F-001 — Hydration mismatch on `/auth/signin`

- **Severity**: medium
- **Dimension**: interaction / performance
- **Page**: `/auth/signin` (and likely other SSR pages; root layout suspect)
- **Reproduce**:
  1. Open browser dev tools → Console
  2. Navigate to `/auth/signin`
  3. Observe React hydration mismatch warning
- **Expected**: SSR HTML matches client HTML.
- **Actual**: SignInPage renders with different `className` and DOM structure server vs. client. React regenerates the tree on the client. Visible flicker on slow connections + perf hit.
- **Evidence**: Console error in Playwright smoke-test session. Diff: server has `flex min-h-screen items-center justify-center` on the outer wrapper while client has `flex min-h-screen`. Inner panels also differ entirely (server renders a loading spinner, client renders the form).
- **Suggested fix**: `apps/admin/src/routes/auth/signin*.tsx`. Likely a conditional based on a value that differs SSR vs CSR (matchMedia, locale, theme, user-state hook).
- **Effort**: M

### F-002 — Better Auth returns 500 on invalid credentials (should be 401)

- **Severity**: medium
- **Dimension**: interaction (UX) / robustness
- **Page**: API endpoint `/api/auth/sign-in/email` (consumed by `/auth/signin`)
- **Reproduce**:
  1. `curl -X POST http://localhost:3001/api/auth/sign-in/email -d '{"email":"x","password":"WRONG"}'`
  2. Observe HTTP 500 with empty body
- **Expected**: HTTP 401 with a structured error body.
- **Actual**: HTTP 500, empty body. User sees only "Sign in failed" with no actionable info.
- **Evidence**: Direct curl + Playwright network log during smoke test.
- **Suggested fix**: Better Auth misconfiguration or unhandled exception in the email/password adapter. Map auth errors to proper HTTP codes in the error handler.
- **Effort**: S

### F-003 — Missing `<title>` element on every admin page (axe `serious`)

- **Severity**: high
- **Dimension**: a11y / SEO
- **Page**: **ALL 105 OK pages** (confirmed via aggregated axe report)
- **Reproduce**: Load any admin page. `document.title === ""`. `<head>` has no `<title>`.
- **Expected**: Each route sets a unique, descriptive `<title>` (e.g. "Panel de Control — Hospeda Admin").
- **Actual**: `<title>` absent. Browser tab shows raw URL. Screen readers cannot announce page identity. SEO-irrelevant for admin (behind auth) but still a real a11y blocker for screen reader users.
- **Evidence**: 105 axe reports flag `document-title`. Sample HTML: `<html lang="en">` (no `<title>` child).
- **Suggested fix**: Add `<title>` via TanStack Start's `head` API in `__root.tsx` with a base title, and per-route head overrides. Use i18n.
- **Effort**: M (wiring is per-route but propagates from a small set of layout files).

### F-004 — Heading order skips levels (axe `moderate`)

- **Severity**: medium
- **Dimension**: a11y
- **Page**: 4 pages confirmed (dashboard + 3 others) — NOT global. Initial assumption was wrong.
- **Reproduce**: `/dashboard` → DOM has `<h1>Panel de Control</h1>` followed by `<h3>Tráfico (últimos 7 días)</h3>` and `<h3>Actividad reciente</h3>` without an intervening `<h2>`.
- **Expected**: Heading levels increase by one (h1 → h2 → h3).
- **Actual**: Dashboard skips h2.
- **Evidence**: Axe report sample HTML: `<h3 class="mb-1 font-semibold text-sm">Tráfico (últimos 7 días)</h3>`.
- **Suggested fix**: Promote dashboard panel headings from h3 to h2, OR wrap each KPI section in an h2 group title.
- **Effort**: XS

### F-011 — Tabs component has invalid ARIA structure (axe `critical` × 2 rules × 25 pages)

- **Severity**: critical (a11y)
- **Dimension**: a11y
- **Page**: 25 pages — every VIEW/EDIT page that uses the "Page sections" tab navigation
- **Reproduce**:
  1. Load any entity VIEW page (e.g. `/access/users/$id`, `/accommodations/$id`)
  2. Inspect the tab bar (`role="tablist" aria-label="Page sections"`)
  3. Observe `role="tab"` elements are NOT direct children — they're nested in extra wrapper(s)
- **Expected**: `role="tablist"` contains `role="tab"` children directly. Each `role="tab"` must have a `role="tablist"` as direct parent.
- **Actual**: Both `aria-required-children` (the tablist doesn't have required children) and `aria-required-parent` (the tabs don't have required parent) fire. Same root cause: wrapper div breaks the parent-child relationship.
- **Evidence**: Sample HTML:
  ```html
  <div class="scrollbar-thin … overflow-x-auto border-b" role="tablist" aria-label="Page sections">
    <!-- WRONG: extra wrapping breaks tablist→tab direct relationship -->
    <a role="tab" aria-selected="true" data-tab-id="profile" href="…">…</a>
  </div>
  ```
  axe-aggregate.json has all 25 affected pages.
- **Suggested fix**: Locate the shared tabs component (likely `apps/admin/src/components/PageTabs*` or similar). Ensure the `role="tablist"` element contains `role="tab"` elements as DIRECT children, with no intervening `<div>` or scroll-wrapper. The scroll wrapper can sit OUTSIDE the tablist with no role.
- **Effort**: S (single component fix propagates to 25 pages).

### F-013 — `<html lang="en">` for a Spanish-default app

- **Severity**: medium
- **Dimension**: a11y
- **Page**: ALL pages (root HTML)
- **Reproduce**: Inspect any admin page. `<html lang="en">`.
- **Expected**: `<html lang="es">` for the default locale (or dynamic based on user locale).
- **Actual**: Hard-coded "en". Screen readers will pronounce Spanish content with English phonemes. Browser translation widgets will offer to translate ES→EN.
- **Evidence**: All 105 axe reports show `<html lang="en">` in document-title sample target.
- **Suggested fix**: Set `lang` from locale in the root layout's `<html>` element. TanStack Start's head/meta config.
- **Effort**: XS

### F-014 — Sortable column header buttons fail color contrast (axe `serious`)

- **Severity**: high (a11y)
- **Dimension**: a11y
- **Page**: 36 pages — every LIST page with a sortable DataTable
- **Reproduce**:
  1. Open any LIST page (e.g. `/access/users`, `/accommodations`)
  2. Inspect column headers — they're buttons with `aria-label="Ordenar columna"`
  3. Run axe — color-contrast fires on these
- **Expected**: WCAG 2.1 AA → 4.5:1 contrast for normal text, 3:1 for large/UI text. Sort-toggle text on header background must meet this.
- **Actual**: Insufficient contrast. Affects users with low vision.
- **Evidence**: Sample HTML: `<button class="inline-flex items-center gap-1 underline-offset-4 hover:underline" aria-label="Ordenar columna">Nombre Visible<span class="text-xs"></span></button>`. The text color likely uses `text-muted-foreground` or similar low-contrast token in a context that needs full contrast.
- **Suggested fix**: Bump the header button text color to a higher-contrast token (e.g., `text-foreground` instead of `text-muted-foreground`) in the DataTable header component (`@repo/ui` / `apps/admin/src/components/DataTable*`).
- **Effort**: XS

### F-015 — Combobox dropdown buttons without accessible name (axe `critical`)

- **Severity**: critical (a11y)
- **Dimension**: a11y
- **Page**: 2 pages (specific component variant — needs identification)
- **Reproduce**: Inspect the affected pages (see `_fixtures/axe-aggregate.json` rule `button-name`).
- **Expected**: Every button must have either visible text or `aria-label`.
- **Actual**: Radix combobox button renders with `role="combobox" aria-expanded="false"` but no accessible name. Screen reader announces "button" with no context.
- **Evidence**: Sample HTML: `<button type="button" role="combobox" aria-controls="radix-«Rcktmj6»" aria-expanded="false" aria-autocomplete="none" dir="ltr" data-state="closed" class="flex h-10 items-cent...">`.
- **Suggested fix**: Add `aria-label` to the affected combobox usage(s). Likely a Radix Select / Combobox missing a `name` prop in 2 specific places. Inspect `axe-aggregate.json` for exact URLs.
- **Effort**: XS-S

### F-016 — Native `<select>` filters without label (axe `critical`)

- **Severity**: critical (a11y)
- **Dimension**: a11y
- **Page**: 5 pages with filter dropdowns
- **Reproduce**:
  1. Open a LIST page with a "Status filter" dropdown
  2. Inspect: `<select><option>Todos los estados</option>…</select>` — no `<label>` or `aria-label`
- **Expected**: Native `<select>` must have a programmatically associated label.
- **Actual**: Sample HTML: `<select class="rounded-md border px-3 py-2 text-sm"><option value="all" selected="">Todos los estados</option>…</select>` — orphan select.
- **Evidence**: 5 page URLs in `_fixtures/axe-aggregate.json` rule `select-name`.
- **Suggested fix**: Wrap in `<label>` or add `aria-label="Filtrar por estado"`. Likely a shared FilterBar component.
- **Effort**: XS

### F-017 — Progress bars without accessible name (axe `serious`)

- **Severity**: high (a11y)
- **Dimension**: a11y
- **Page**: 11 pages — pages with upload / async progress indicators
- **Reproduce**: Inspect pages with progress indicators (e.g., billing pages, upload flows).
- **Expected**: `role="progressbar"` element must have `aria-label` or `aria-labelledby` so AT users know what's progressing.
- **Actual**: Sample HTML: `<div class="w-full overflow-hidden rounded-full bg-muted h-2 mb-2" role="progressbar" tabindex="0" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">…</div>` — no label.
- **Suggested fix**: Add `aria-label` to the progressbar component (or accept it as a prop). Common pattern: `<ProgressBar label="Cargando subscripciones" value={...} />`.
- **Effort**: XS

### F-018 — Pages missing an `<h1>` (axe `moderate`)

- **Severity**: medium (a11y)
- **Dimension**: a11y
- **Page**: 38 pages
- **Reproduce**: Inspect affected pages — no `<h1>` element.
- **Expected**: Every page should have exactly one `<h1>` representing the page's main subject.
- **Actual**: 38 pages have zero h1. Likely entity VIEW/EDIT pages where the entity name is rendered as a `<div>` or `<span>` with heading-like styling but no semantic tag.
- **Evidence**: Sample target `["html"]` (axe complaining at document level).
- **Suggested fix**: Identify the entity name component (`EntityPageHeader` or similar) and ensure it renders an `<h1>` with the entity title.
- **Effort**: S

### F-019 — Empty `<h1>` elements (axe `minor`)

- **Severity**: low
- **Dimension**: a11y
- **Page**: 20 pages
- **Reproduce**: Inspect affected pages — `<h1 class="font-semibold text-2xl"></h1>` (empty).
- **Expected**: `<h1>` must have text content.
- **Actual**: Heading element exists but its text content is empty. Likely a loading state where the entity name hasn't loaded by the time axe runs; if so, it's a noise finding. If it's a permanent state, it's a real bug.
- **Evidence**: Sample HTML: `<h1 class="font-semibold text-2xl"></h1>`.
- **Suggested fix**: Render the h1 only when the data is loaded, OR show a skeleton placeholder text. Investigate the 20 affected URLs to confirm if real or load-timing artifact.
- **Effort**: S

---

## Page-specific findings (visual / responsive)

### ~~F-005 — Dashboard KPI cards lose values on mobile~~ (FALSE POSITIVE — withdrawn)

- **Status**: withdrawn 2026-05-15 after sweep re-run with proper content-loaded waits
- **Original claim**: KPI numeric values absent on mobile
- **Reality**: The original sweep capture used a `waitForTimeout(800ms)` after network idle. That fired before TanStack Query refetched + rendered the KPI data, so the screenshot caught a mid-flight "title rendered, value not yet rendered" state. Re-capture with explicit content-ready waits (spinners gone + h1 has text + 1.8s settle) shows numbers correctly: 104 / 27 / 24 / 18 / 88 / 43 on both viewports.
- **Lesson**: When auditing TanStack Query / React-Query apps, `networkidle` is not sufficient to detect render completion. Need to wait for known content signals.

### F-006 — "Reportar problema" FAB overlaps content on mobile

- **Severity**: high
- **Dimension**: responsive
- **Page**: ALL admin pages (global fixed-position FAB)
- **Reproduce**: Any admin route at 375×667 viewport.
- **Expected**: FAB sits in corner without occluding content; page bottom padding accounts for FAB.
- **Actual**: FAB renders mid-right, partially or fully covering content (e.g., over "Eventos" KPI card on dashboard, over "Granular" card on access/permissions).
- **Evidence**: `dashboard-mobile.png`, `access__permissions-mobile.png`.
- **Suggested fix**: `position: fixed; bottom: 1rem; right: 1rem;` on mobile + add `padding-bottom: 5rem` to main content scroll container. FAB component lives near the root layout.
- **Effort**: S

### F-008 — Same FAB overlaps content on desktop (minor)

- **Severity**: medium
- **Dimension**: responsive / visual
- **Page**: ALL admin pages
- **Reproduce**: Desktop (1280×800) on `/access/roles` — FAB overlapping "Editor" role card.
- **Expected**: FAB flush bottom-right with consistent margin, never overlapping primary content.
- **Actual**: FAB inset (likely `right: 5rem` or similar), so on narrower desktop widths it lands over content.
- **Evidence**: `access__roles-desktop.png`.
- **Suggested fix**: Same component as F-006 — tighten positioning rules.
- **Effort**: XS

### F-010 — Role-card badges mix Spanish and English

- **Severity**: low
- **Dimension**: visual (i18n)
- **Page**: `/access/roles`
- **Reproduce**: Inspect role badges: "Super Admin" → "Acceso Total" (ES ✅), "Editor" → "Medio Access" (mixed ❌), "Usuario" → "Bajo Access" (mixed ❌), etc.
- **Expected**: All badges in Spanish — "Medio Acceso", "Bajo Acceso".
- **Actual**: Mixed.
- **Evidence**: `access__roles-desktop.png`.
- **Suggested fix**: i18n key fix in `packages/i18n/locales/es/*.json` under the access roles namespace.
- **Effort**: XS

---

## Skipped pages

These were skipped during sweep due to missing DB seed data. They still need to be audited; either seed the data, or do a fixture-based pass later.

| URL | Reason |
|---|---|
| `/conversations/$id` | No `conversations` row in DB |
| `/newsletter/campaigns/$campaignId` | No `newsletter_campaigns` row |
| `/sponsors/$id` | No `sponsorships` row |
| `/sponsors/$id/edit` | No `sponsorships` row |
| `/tags/entity-attribution/$type/$id` | Needs both `$type` and `$id` — no canonical default |

**Followup**: Seed example data for conversations, newsletter campaigns, sponsorships. Skipped audit pages should be re-run in a complementary mini-sweep.

---

## Visual review pass findings (Phase 5 prep — 2026-05-16)

Surfaced by an agent-driven sample review of 30-50 representative screenshots across all entities. These complement the axe-aggregated rules and the early hand-spot findings above.

### F-020 — Multi-section forms unusable on mobile (sidebar + form columns don't collapse)

- **Severity**: blocker
- **Dimension**: responsive
- **Page**: ALL CREATE + EDIT pages that use the FormShell with section-progress sidebar — `/accommodations/new`, `/accommodations/$id/edit`, `/destinations/new`, `/destinations/$id/edit`, `/posts/new`, `/posts/$id/edit`, `/access/users/new`, `/access/users/$id/edit`, `/events/new`, plus ~25 more (~30+ pages total)
- **Reproduce**:
  1. Open any entity CREATE or EDIT page at 375×667
  2. Observe two columns rendered side-by-side: progress sidebar (~50% width) + form fields (~50% width)
- **Expected**: On mobile, sidebar collapses to top accordion or hides entirely; form fields take full width.
- **Actual**: Both columns persist at fixed widths. Form labels and inputs wrap to ~1-character columns ("D / e / s / c"). Fields overlap labels. Page is completely unusable for editing.
- **Evidence**: `audits/spec-131/accommodations/accommodations__new-mobile.png`, `accommodations/accommodations__id__edit-mobile.png`, `destinations/destinations__new-mobile.png`, `posts/posts__new-mobile.png`, `access/access__users__id__edit-mobile.png`
- **Suggested fix**: In the shared FormShell layout (likely `apps/admin/src/components/forms/FormShell.tsx`), the grid should be `grid-cols-1 lg:grid-cols-[280px_1fr]` instead of fixed two-column at all sizes. Sidebar can become a `<details>` accordion on mobile.
- **Effort**: M

### F-021 — LIST tables don't degrade on mobile (truncated columns, no scroll, no card view)

- **Severity**: high
- **Dimension**: responsive
- **Page**: ALL LIST pages with DataTable — `/accommodations`, `/access/users`, `/events`, `/posts`, `/destinations`, all `/billing/*` lists, all `/content/*`, all `/tags/*` (~30 pages)
- **Reproduce**:
  1. Open `/accommodations` at 375×667
  2. Observe only "Nombre" + "Tipo" columns visible. "Tipo" badges truncate to `Departar...`, `Habitació...`. No horizontal scroll, no card view fallback.
- **Expected**: Either (a) horizontal scroll wrapper with sticky first column + visible scroll affordance, or (b) collapse rows into stacked cards on mobile (similar to the existing `Cuadrícula` toggle).
- **Actual**: Important columns (Destino, Propietario, Precio, Calificación, Reseñas, Destacado, Estado, Acciones) silently hidden. Operator cannot see status, owner, price, or interact with row actions on mobile.
- **Evidence**: `audits/spec-131/accommodations/accommodations-mobile.png`, `access/access__users-mobile.png`, `billing/billing__plans-mobile.png`
- **Suggested fix**: In the shared DataTable component, add a mobile breakpoint that either auto-enables `Cuadrícula` view or wraps the table in `overflow-x-auto` with a scroll hint. Truncated cells should use ellipsis + tooltip with full text.
- **Effort**: L

### F-022 — `/accommodations/$id/gallery` renders the EDIT page (byte-for-byte identical)

- **Severity**: high
- **Dimension**: interaction
- **Page**: `/accommodations/$id/gallery`
- **Reproduce**:
  1. Open `/accommodations/$id/edit` → take screenshot
  2. Open `/accommodations/$id/gallery` → take screenshot
  3. Diff: identical byte-for-byte (md5 matches)
- **Expected**: `/gallery` should render a gallery-specific UI (image grid, upload, reorder).
- **Actual**: It re-renders the full EDIT form. Likely the route file imports the wrong component or re-exports the EDIT view by accident.
- **Evidence**: `audits/spec-131/accommodations/accommodations__id__edit-desktop.png` and `accommodations/accommodations__id__gallery-desktop.png` (identical md5).
- **Suggested fix**: Inspect `apps/admin/src/routes/_authed/accommodations/$id_.gallery.tsx`. Verify the same pattern for the other sibling sub-routes (`$id_.amenities`, `$id_.pricing`, `$id_.reviews` — those DO differ per md5, so they're fine).
- **Effort**: S

### F-023 — Sub-tab pages have no breadcrumb and no entity context

- **Severity**: high
- **Dimension**: interaction
- **Page**: `/accommodations/$id/amenities`, `/accommodations/$id/reviews`, `/accommodations/$id/pricing` (and likely other entity sub-tab routes)
- **Reproduce**:
  1. Open `/accommodations/$id/amenities`
  2. Observe: no breadcrumb, no entity name ("Retiro Soleado") shown anywhere, just "Amenidades" as a section title
- **Expected**: Breadcrumb `Inicio › Alojamientos › Retiro Soleado › Amenidades` + entity name as page header.
- **Actual**: Operator has zero context about which accommodation they're editing. Deep-link arrival means anonymous entity.
- **Evidence**: `audits/spec-131/accommodations/accommodations__id__amenities-desktop.png`, `accommodations__id__reviews-desktop.png`, `accommodations__id__pricing-desktop.png`
- **Suggested fix**: The shared entity-sub-page layout (probably `EntityTabsLayout` or similar) should render the breadcrumb + entity-header on ALL tabs, not only `General`/`Edit`.
- **Effort**: S

### F-024 — Raw API / Zod errors exposed to admin users

- **Severity**: high
- **Dimension**: visual / interaction
- **Page**: `/billing/plans` (Zod validation cascade), `/billing/settings` ("Billing service is not configured"), `/billing/invoices` (unhelpful)
- **Reproduce**:
  1. Open `/billing/plans`
  2. Observe red error box with: "Invalid plan record from API: Invalid input: expected string, received undefined, Invalid input: expected boolean, received undefined, …"
- **Expected**: User-friendly Spanish message ("No se pudieron cargar los planes. Reintentá o contactá soporte.") + raw error logged to Sentry only.
- **Actual**: Internal Zod validation strings leak straight to the UI. Mixed languages. Operator confused.
- **Evidence**: `audits/spec-131/billing/billing__plans-mobile.png`, `billing__plans-desktop.png`, `billing__settings-desktop.png`
- **Suggested fix**: Wrap API errors in user-facing message at hook/page level; pipe details to logger only. Separately, the upstream Zod schema for `/billing/plans` mismatches the API response shape — needs schema alignment.
- **Effort**: S (UX wrap) + M (schema alignment) = two PRs

### F-025 — Breadcrumbs show raw URL slug instead of translated label

- **Severity**: medium
- **Dimension**: visual / i18n
- **Page**: All `/billing/*` pages and `/notifications`
- **Reproduce**:
  1. Open `/billing/exchange-rates` → breadcrumb reads `Inicio › Billing › Exchange-rates`
  2. Open `/notifications` → `Inicio › Notifications`
- **Expected**: Translated labels — `Inicio › Facturación › Tasas de Cambio`, `Inicio › Notificaciones`.
- **Actual**: Last segments use the URL slug verbatim with naive capitalization. Inconsistent with `/access/users` which DOES show "Access › Lista" (also wrong but different bug).
- **Evidence**: `audits/spec-131/billing/billing__exchange-rates-desktop.png`, `billing__invoices-desktop.png`, `notifications/notifications-desktop.png`
- **Suggested fix**: Breadcrumb component (likely `apps/admin/src/components/Breadcrumb*`) should resolve segments through an i18n key map keyed by route, not fall back to slug → titleCase.
- **Effort**: S

### F-026 — Sub-tab empty states are in English on a Spanish app

- **Severity**: medium
- **Dimension**: visual / i18n
- **Page**: `/accommodations/$id/amenities` ("No amenities assigned to this accommodation.")
- **Reproduce**: Open the amenities sub-tab of any accommodation with no amenities.
- **Expected**: "No hay amenidades asignadas a este alojamiento." + a CTA button "Agregar amenidad".
- **Actual**: English placeholder, no CTA, vague.
- **Evidence**: `audits/spec-131/accommodations/accommodations__id__amenities-desktop.png`
- **Suggested fix**: Wire empty-state text through i18n; add primary CTA pointing at the add-amenity flow.
- **Effort**: XS

### F-027 — Plan descriptions in English in a Spanish-default app

- **Severity**: medium
- **Dimension**: visual / i18n
- **Page**: `/billing/plans` (rows: Basic / Professional / Premium / Complex Basic / Free / Plus / VIP)
- **Reproduce**: Open `/billing/plans`, "Descripción" column reads "Basic plan for individual property owners.", "Professional plan with advanced analytics…"
- **Expected**: Spanish descriptions (or i18n-driven content with es/en/pt variants).
- **Actual**: Hard-coded English copy in source-defined plan definitions.
- **Evidence**: `audits/spec-131/billing/billing__plans-mobile.png`, `billing__plans-desktop.png`
- **Suggested fix**: Plan descriptions appear source-defined (error panel says "Mostrando los planes definidos en el código fuente"). Move copy into i18n locale files keyed by plan ID, OR localize the source-defined strings.
- **Effort**: S

### F-028 — `/notifications` has duplicate h1+h2 with identical text and English breadcrumb

- **Severity**: medium
- **Dimension**: visual
- **Page**: `/notifications`
- **Reproduce**: Open `/notifications`. Observe two stacked "Notificaciones" headings (h1 + h2) with "Todas las notificaciones leídas" sub-line under the second.
- **Expected**: Single h1 "Notificaciones" with status line beneath. Breadcrumb in Spanish.
- **Actual**: Two visually identical titles waste vertical space + confusing hierarchy. Breadcrumb says "Notifications".
- **Evidence**: `audits/spec-131/notifications/notifications-desktop.png`
- **Suggested fix**: Remove the redundant h2, or have it say something else (e.g., "Recientes"). Combine with F-025 for breadcrumb i18n.
- **Effort**: XS

### F-029 — `/billing/cron` action buttons render as oversized full-width black bars

- **Severity**: medium
- **Dimension**: visual
- **Page**: `/billing/cron`
- **Reproduce**: Open `/billing/cron`. Each cron card has an "Ejecutar ahora" button rendered as a full-width black rectangle that visually dominates the card.
- **Expected**: Compact secondary button (cron triggers are admin-rare actions, not primary CTAs).
- **Actual**: 17+ cron rows × giant black bar = page looks like a stack of black ribbons. Visual hierarchy inverted (toggles and metadata drowned out).
- **Evidence**: `audits/spec-131/billing/billing__cron-desktop.png`
- **Suggested fix**: Downgrade button variant from `default`/`primary` to `outline` or `ghost`; right-align inside card footer instead of stretching full width.
- **Effort**: XS

### F-030 — `/access/users` mobile shows two identical name columns, no useful info

- **Severity**: medium
- **Dimension**: responsive
- **Page**: `/access/users`
- **Reproduce**: Open `/access/users` at 375×667. Table shows "Nombre Visible" + "Nombre Completo" with identical text per row. Email, role, status, last login, actions all hidden (related to F-021 but worth a separate finding — the two visible columns are redundant).
- **Expected**: On mobile, prioritize columns that actually differ: name + email + role + status. Drop "Nombre Visible" since it duplicates.
- **Actual**: Operator cannot distinguish users — they all look like duplicate rows.
- **Evidence**: `audits/spec-131/access/access__users-mobile.png`
- **Suggested fix**: In the users DataTable column config, mark `nombreVisible` as `desktop-only` or merge with `nombreCompleto`, and promote `email` + `rol` to always-visible.
- **Effort**: XS

### F-031 — Dashboard sidebar nav has visual gap that looks accidental

- **Severity**: low
- **Dimension**: responsive
- **Page**: `/dashboard` desktop
- **Reproduce**: Open `/dashboard` at 1280×800. Left sidebar items "Notificaciones / Mi Perfil / Configuración" are separated from "Resumen / Mis Alojamientos" by a large blank gap (no divider, no group label).
- **Expected**: Tighter spacing OR group titles ("Personal" / "Trabajo") to justify the gap.
- **Actual**: Visual gap looks accidental; operator may assume the second group is unrelated.
- **Evidence**: `audits/spec-131/dashboard/dashboard-desktop.png`
- **Suggested fix**: Add a group label or reduce the divider gap in AppSidebar nav config.
- **Effort**: XS

---

## Pending sections

- **Phase 2 visual+interaction sweep** (interactive states on 30 critical pages): pending. Recommended if Phase 5 closure surfaces specific interactive concerns not visible in static screenshots.
- **Phase 4 Lighthouse**: skipped 2026-05-15 per operator decision; can be re-added later for ranking.
- **Phase 5 final aggregation**: pending. Will reconcile cross-cutting findings into root-cause groups and prune low-value duplicates.

---

## Methodology notes

- All axe runs at desktop viewport (1280×800). Some WCAG rules ARE viewport-dependent (target-size, focus on collapsed nav) — these are NOT captured here. If the count of mobile-specific findings warrants, a complementary axe-mobile pass can be added.
- Auth fixture: `superadmin@hospeda.com / Audit2026!`. The password was set during this audit (the seed-generated random password was overwritten on 2026-05-15 with explicit user approval — captured in the F-002 + auth-flow narrative).
- Re-runnable: `cd audits/spec-131/_scripts && bun sweep.ts` regenerates all artifacts. Set `ONLY_ENTITY=foo` or `ONLY_PRIORITY=critical` to scope.

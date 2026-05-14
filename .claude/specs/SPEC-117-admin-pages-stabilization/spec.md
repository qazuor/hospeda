---
spec-id: SPEC-117
title: Admin Pages Stabilization
type: remediation
complexity: very-high
status: draft
created: 2026-05-14T00:00:00.000Z
effort_estimate_hours: 48-72
tags: [admin, api, schemas, i18n, billing, newsletter, react, ux, kysely, better-auth, crud, visual, style, console]
branch: fix/admin-pages-audit
worktree: ../hospeda-admin-pages-audit
---

# SPEC-117: Admin Pages Stabilization

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Restore the Hospeda admin app to a fully usable state by closing the defects in §4 across
**8 categories**:

1. **Admin API schema mismatches** — endpoints returning 500 with "Response payload does not match
   declared schema" (A-1..A-6).
2. **Client-side crashes** inside billing and revalidation pages (C-1..C-3).
3. **Billing service connectivity** — 503/429 cascades (B-1..B-5).
4. **i18n placeholder leaks and English-text bleed** (I-1..I-5).
5. **Smaller UX defects** — newsletter sort param, plan-limit gating, retry storm (M-1..M-3, N-1..N-2).
6. **CRUD operation verification (NEW)** — create / edit / soft-delete / restore for every main
   entity, verified end-to-end through the admin UI plus DB inspection (D-1..D-N, see §4).
7. **Visual / Style audit (NEW)** — spacing, sizing, alignment, padding/margin consistency, elements
   touching/overlapping, typography hierarchy, viewport responsiveness, dark mode (V-1..V-N, see §4).
8. **Console error sweep (NEW)** — capture and triage every console error / warning surfaced during
   navigation across all admin routes; items not covered by A/C/B above become CE-* findings
   (CE-1..CE-N, see §4).

The first 5 categories were captured in the original audit (`docs/admin-pages-audit-report.md`).
Categories 6, 7 and 8 are added here as a deliberate scope expansion: a stable admin must not just
**load** — it must **work correctly** (CRUD), **look correct** (visual), and **stay quiet** in the
console under normal operator usage. Without these three additions, a "passing" stabilization could
silently ship broken Save buttons, misaligned forms, or a stream of warnings that mask real bugs.

> **Two-step process — read carefully.**
> The D / V / CE categories below are **placeholders** today. Their concrete findings (D-1.1, V-1,
> CE-1, etc.) do NOT exist yet — they will be **discovered** by running the **Discovery Phase**
> first (see §6, Phase Discovery). The Discovery Phase produces:
>
> 1. CRUD smoke reports per main entity → `docs/admin-crud-smoke/<entity>.md`
> 2. Visual baseline screenshots → `docs/admin-pages-audit-screenshots/before/...`
> 3. Console error log → appended to `docs/admin-pages-audit-report.md`
>
> Once Discovery finishes, the operator (Claude or human) **re-opens this spec** and fills §4
> (D / V / CE sections) with the concrete findings discovered. **Only then** the implementation
> phases begin. This separation prevents implementation work from starting on a moving spec.

**Motivation:**

- The admin app currently presents a degraded experience to operators: 6 list pages return 500s with
  the same `"Response payload does not match declared schema"` error, 3 pages crash entirely with React
  error boundaries on first render, and ~5 billing pages cannot reach their backend services. The defects
  block day-to-day operations (creating users, posts, tags; managing subscriptions; revalidating ISR).
- All defects in this spec were surfaced by an end-to-end audit (every list page + every "new" form +
  representative detail pages, navigated in Chrome with full console + network capture as
  `superadmin@hospeda.com` / SUPER_ADMIN). Each finding includes the failing endpoint, the exact error
  surface, and the most likely root cause.
- A dev-server-blocking issue (kysely × better-auth) was already remediated under this branch as a
  precondition for the audit; documented here in §4 (A1) for completeness so it survives the merge to
  staging and is not silently re-introduced.

**Success criteria:**

- All defects in §4 closed with the verification per-item (current count: 21 from original audit
  + new D/V/CE items captured during phases 6-8).
- Zero React error boundaries on any admin route under normal navigation as SUPER_ADMIN.
- Zero `[ApiError: Response payload does not match declared schema]` console errors under normal navigation.
- All `*/new` pages render a clean title (no `{entity}` placeholder leak).
- Detail page headers and shared list-table column labels render in the active locale (no English bleed
  on Spanish renderings — verified at minimum on `es`).
- `pnpm dev:admin` boots cleanly from a freshly-installed worktree.
- **Functional CRUD verified end-to-end for every main entity** — create produces a row reachable
  via list + detail, edit persists changes, soft delete removes from default list but keeps row
  with `deleted_at` set, restore brings it back. Verified in browser AND via direct DB query for
  the persistence side. (See §8 for the methodology checklist.)
- **Visual baseline established and critical defects closed** — desktop (1280×800) + tablet (768×1024)
  + mobile (375×667) screenshots of every list, detail, and create page, captured to
  `docs/admin-pages-audit-screenshots/`. Critical visual defects (overlapping elements, broken
  layouts, illegible text, viewport overflow) closed; cosmetic defects logged for follow-up.
- **Console error sweep completed** — every page visited with DevTools open, every error/warning
  triaged into one of: (a) covered by an existing A/C/B finding, (b) new CE-* finding added to §4,
  (c) third-party library noise documented + suppressed. Final pass shows zero unexplained errors.
- CI passes (typecheck, biome, vitest) on all packages touched.

### 2. Target Users

- Primary: Hospeda admin operators (SUPER_ADMIN, ADMIN, CLIENT_MANAGER) using the admin panel
  in `apps/admin` for day-to-day platform management.
- Secondary: developers working locally — the dev server fix (A1) and the workspace-build
  prerequisite documentation (A2) directly affect onboarding and feature work on the admin.

### 3. Out of Scope

The audit observed the following items that are NOT addressed by this spec:

| Item | Why not |
|---|---|
| Detail pages with `$id_.<subroute>` (gallery, amenities, pricing, reviews, attendees, tickets, attractions, accommodations, events, contact, organizers events, edit) | Not exercised in the audit (would need IDs per entity-type and would multiply pages by ~30). Likely share root causes with the LIST 500s (B1) — close A* tasks first, then re-audit. |
| Default `destinationType=CITY` filter on `/destinations` listing | Intentional default per the URL pattern (filter chip + "Limpiar todo" exposed). Documented in audit as expected behavior, not a bug. |
| `/sponsor`, `/sponsor/analytics` "Próximamente" placeholders | Self-documented as not-yet-implemented features. Out of scope for stabilization. |
| `dashboard` 'Actividad reciente' / 'Tráfico' panels | Self-documented as awaiting audit log + analytics provider integration. Out of scope. |
| `/billing/plans` editing | Self-documented as read-only ("La fuente única de verdad es packages/billing/src/config/plans.config.ts"). SPEC-093 covers admin-editable billing plans. |
| Vite deprecation warnings (B7) | Cosmetic dev noise (e.g. `optimizeDeps.rollupOptions` → `optimizeDeps.rolldownOptions`). Tracked separately (no user impact). |
| Admin app build / production behavior | Audit confirmed Coolify deploys staging admin without these symptoms — root cause for A1 is dev-only (`vite dev` + rolldown optimizeDeps). |

### 4. Findings Catalog

All findings come from `docs/admin-pages-audit-report.md` in this branch. Each item below is
self-contained: file/path, root cause hypothesis, fix direction, acceptance criteria.

Severity prefix:

- **C** — Critical client crash (full error boundary, page unusable)
- **A** — API schema mismatch (admin endpoint returns 500, client receives `Response payload does not match declared schema`)
- **B** — Billing service unreachable (503 → 429)
- **I** — i18n placeholder / English-text bleed
- **N** — Newsletter-specific
- **M** — Misc (gating, retry storm, infrastructure)
- **A1/A2** — Pre-existing infrastructure already addressed under this branch
- **D** — CRUD operation defect (create / edit / soft-delete / restore broken or unverified)
- **V** — Visual / Style defect (spacing, sizing, alignment, overlap, typography, responsiveness)
- **CE** — Console error / warning surfaced during navigation (not covered by A/C/B)

---

#### Pre-existing infrastructure (already remediated under this branch — do NOT re-introduce)

##### **A1. `vite dev` admin crash on `optimizeDeps` due to `kysely` × `better-auth` mismatch**

- **Files:**
    - `apps/admin/src/lib/kysely-shim.mjs` (NEW, this branch)
    - `apps/admin/vite.config.ts` (`resolve.alias` rewritten to array form, this branch)
- **Root cause:** `better-auth@1.4.18` SQLite dialect adapters (`bun-sqlite-dialect.mjs`,
  `node-sqlite-dialect.mjs`) statically import `DEFAULT_MIGRATION_TABLE` and
  `DEFAULT_MIGRATION_LOCK_TABLE` from `kysely`. Kysely 0.29 moved those constants to
  `kysely/migration` sub-path; the bare-package re-export is now a `KyselyTypeError` marker.
  Vite 8's rolldown-based `optimizeDeps` is strict on `[MISSING_EXPORT]` and exits 1.
- **Production unaffected:** Coolify runs `vite build` (Rollup path) which warns instead of crashing.
- **Fix shipped:** Shim re-exports `kysely/dist/index.js` plus the two constants from
  `kysely/migration`. Vite alias for **exact** `kysely` (regex `^kysely$`) maps to shim — sub-paths
  like `kysely/migration` are unaffected. Runtime untouched (admin uses postgres adapter).
- **Acceptance:** `pnpm dev:admin` reaches `Local: http://localhost:3000/` and stays up.
  `GET /` returns 200 (or 200 + redirect to `/auth/signin`) without console errors related to
  `MISSING_EXPORT` or kysely.

##### **A2. Workspace packages must be built before `pnpm dev:admin` can serve a request**

- **Files:** `apps/admin/vite.config.ts:150-163` (current `resolve.alias` aliases 8 of ~12 workspace
  packages to `src/`; `@repo/feedback`, `@repo/auth-ui`, `@repo/billing`, `@repo/notifications` are
  NOT aliased and must be consumed via `dist/`).
- **Root cause:** Fresh `pnpm install` does not produce `packages/*/dist/`. The unaliased packages
  resolve to `dist/` per their `exports` field, and SSR fails on first request with
  `ERR_MODULE_NOT_FOUND: @repo/feedback/schemas`.
- **Fix direction (one of):**
    1. Add `pnpm turbo run build --filter='admin^...'` as a pre-step in `scripts/dev-admin.js`.
    2. Extend the `resolve.alias` array to point those four packages at `src/` like the others
       (lower friction, but only works if their `src/` exports are usable directly by Vite —
       likely yes for `@repo/feedback` and `@repo/auth-ui`; verify per package).
- **Acceptance:** Documented in `apps/admin/CLAUDE.md` and either automated via the dev script or
  resolved by alias coverage. Fresh worktree works without manual `turbo build`.

---

#### C — Critical client-side crashes (3 items)

##### **C-1. `/billing/addons` crashes on render (`undefined.reduce`)**

- **File:** `apps/admin/src/routes/_authed/billing/addons.tsx` and the hook(s) it consumes.
- **Console:** `TypeError: Cannot read properties of undefined (reading 'reduce')` inside `<Lazy>`
  component, caught by `FeedbackErrorBoundary`. Followed by:
  `Uncaught Error: There was an error during concurrent rendering but React was able to recover…`.
- **No API calls made before crash** — the bug is purely client-side initial-state.
- **Root cause hypothesis:** A hook returns `undefined` (instead of `[]`) before the query resolves,
  and code calls `.reduce()` on it without nullish-coalescing. Common pattern is destructuring
  `{ data }` from `useQuery` without defaulting (`data?.items.reduce(...)` vs `data.items.reduce(...)`).
- **Fix direction:** Trace the React tree from `<Lazy>` outward, locate the `.reduce()` call, default
  the source to `[]`. Audit sibling hooks for the same pattern in `addons.tsx` and shared utils.
- **Acceptance:** `/billing/addons` renders the addons list (or empty state) without error boundary.
  No `TypeError` in console.

##### **C-2. `/billing/subscriptions` crashes on render (same `.reduce()` signature as C-1)**

- **File:** `apps/admin/src/routes/_authed/billing/subscriptions.tsx`.
- **Console:** identical error signature to C-1. **No API calls made before crash.**
- **Root cause hypothesis:** Same as C-1 — likely a shared hook or a pattern copy-pasted between
  `addons.tsx` and `subscriptions.tsx`. Fixing C-1 may close C-2 in the same change.
- **Fix direction:** After C-1 root cause is identified, verify it covers `subscriptions.tsx`. If
  not, repeat the trace.
- **Acceptance:** `/billing/subscriptions` renders the subscriptions list (or empty state) without
  error boundary. No `TypeError` in console.

##### **C-3. `/revalidation` crashes on render (`configs.map is not a function`)**

- **File:** `apps/admin/src/routes/_authed/revalidation/index.tsx`, component `<ConfigTab>`.
- **Console:** `TypeError: configs.map is not a function`.
- **Root cause hypothesis:** `configs` initialized as something other than an array (likely
  `undefined` or an object `{}`). May be the same hook-returns-undefined pattern as C-1/C-2 but
  here `.map` instead of `.reduce`.
- **Fix direction:** Default `configs` to `[]` at usage site OR fix the hook to return `[]` until
  data arrives.
- **Acceptance:** `/revalidation` renders the ISR revalidation tabs and config list without error
  boundary. No `TypeError` in console.

##### **C-4. `/billing/plans` crashes when no plans seeded (regression discovered after `db:fresh-dev`)**

- **File:** `apps/admin/src/routes/_authed/billing/plans.tsx`.
- **Console:** identical signature to C-1/C-2: `TypeError: Cannot read properties of undefined
  (reading 'reduce')` inside `<Lazy>`, caught by `FeedbackErrorBoundary`.
- **Discovery context:** during T-041 visual baseline, `/billing/plans` was confirmed crashed
  AFTER a `pnpm db:fresh-dev` run. The original audit (`docs/admin-pages-audit-report.md`) saw
  9 plans rendering OK because plans were seeded. **The page does not handle the empty/undefined
  state.**
- **Fix direction:** Same as C-1: trace the `<Lazy>` consumer that calls `.reduce()`, default
  the source to `[]`. Likely the SAME hook backing C-1, C-2, and C-4 — single fix may close all
  three.
- **Acceptance:** `/billing/plans` renders an empty-state UI (or the seeded list) without error
  boundary. No `TypeError` in console.

**Cross-cutting note**: C-1, C-2, C-4 all crash with the same `undefined.reduce()` signature in
billing routes. Almost certainly a shared `useBillingPlans()` (or similar) hook returning
`undefined` while loading. Single fix → 3 routes unblocked.

---

#### A — Admin API schema mismatch 500s (6 items, single root-cause cluster)

All 6 items return HTTP 500 from the API with the client-visible error
`"ApiError: Response payload does not match declared schema"`. This means the route handler ran
and produced a payload, but the OpenAPI/Zod **response** schema rejected it on serialization.
Likely causes (one of):

- The service `.list()` / `.getById()` returns a relation shape (joins) that the corresponding
  `*.AdminSchema` in `@repo/schemas` does not declare.
- A new column was added to the DB and surfaced by the service but not added to the admin schema.
- A nullable field is non-null in the schema (or vice versa).
- A nested object got renamed (e.g. `tags` → `assignments`) on the service side without a schema
  update.

A working test for the diagnosis: hit each endpoint with `curl -H 'Authorization: Bearer <token>'`
and inspect the `apps/api` log for the first Zod issue (route factory should already print the
issue path + expected vs. received).

##### **A-1. `GET /api/v1/admin/users?page=...&pageSize=...` returns 500 (schema mismatch)**

- **Used by:** `/dashboard` (×2 calls, blocks Users counter), `/access/users` (list page), `/analytics/business`.
- **Likely surfaces:** richer relations on user (roles, permissions, accounts/credentials).
  Compare the service's list output against `UserAdminSchema` (or `UserAdminListItemSchema` if
  that's the variant used by the admin LIST route).
- **Fix direction:** (1) Reproduce with `curl`; capture the exact Zod issue from API logs.
  (2) Update either the service mapper or the schema to align; **prefer extending the schema** when
  the service correctly reflects new product needs (do not strip data).
  (3) Add a snapshot/contract test in `apps/api/test/routes/...` that hits the route and parses
  through the response schema, so future regressions fail at unit-test time, not in the browser.
- **Acceptance:**
    - `GET /api/v1/admin/users?page=1&pageSize=25` returns 200 with a non-empty list (DB has users).
    - Dashboard "Users" counter shows the real count (currently `...`).
    - `/access/users` list table renders rows.

##### **A-2. `GET /api/v1/admin/posts?page=...&pageSize=...` returns 500 (schema mismatch)**

- **Used by:** `/dashboard` (Posts counter), `/posts` list page, `/analytics/business`.
- **Likely surfaces:** post relations (author, tags, sponsorship). Compare service list output against
  `PostAdminSchema` / `PostAdminListItemSchema`.
- **Fix direction:** Same procedure as A-1.
- **Acceptance:** `/posts` renders rows (DB has posts); dashboard Posts counter shows real number.

##### **A-3. `GET /api/v1/admin/tags/internal?page=...` returns 500 (schema mismatch)**

- **Used by:** `/tags/internal`.
- **Fix direction:** Same procedure as A-1; align `InternalTagAdminSchema`.
- **Acceptance:** `/tags/internal` exits "Cargando etiquetas..." and renders rows or empty state.

##### **A-4. `GET /api/v1/admin/posts/tags?page=...` returns 500 (schema mismatch)**

- **Used by:** `/tags/post-tags`.
- **Fix direction:** Same procedure as A-1; align `PostTagAdminSchema`.
- **Acceptance:** `/tags/post-tags` renders rows or empty state.

##### **A-5. `GET /api/v1/admin/tags/system?page=...` returns 500 (schema mismatch)**

- **Used by:** `/tags/system`, possibly `/tags/user-moderation` (verify endpoint URL).
- **Fix direction:** Same procedure as A-1; align `SystemTagAdminSchema`.
- **Acceptance:** `/tags/system` and `/tags/user-moderation` exit "Cargando etiquetas..." and render.

##### **A-6. `GET /api/v1/admin/accommodations/{id}` returns 500 (schema mismatch on detail)**

- **Used by:** `/accommodations/{id}` (and likely all its tabs: `gallery`, `amenities`, `reviews`, `pricing`, `edit`).
- **Note:** `/accommodations` LIST works fine — the bug is only in the GET-by-ID variant. Likely
  `AccommodationAdminDetailSchema` (or similar) misses fields the service includes (full destination,
  full owner, tags, gallery items, etc.).
- **Fix direction:** Same procedure as A-1, but for `AccommodationAdminDetailSchema`. After fix,
  spot-check the 5 sibling tabs (`$id_.gallery.tsx`, `$id_.amenities.tsx`, `$id_.reviews.tsx`,
  `$id_.pricing.tsx`, `$id_.edit.tsx`) — they likely consume the same endpoint and unblock automatically.
- **Acceptance:** `/accommodations/{id}` renders the detail view + 5 tabs without "Cargando…" stuck state.

---

#### B — Billing service connectivity (5 items)

The `/api/v1/protected/billing/*` and one `/api/v1/admin/billing/*` route consistently return
`503 Service Unavailable` followed immediately by `429 Too Many Requests` on the client retry.
The 429 is a **secondary** symptom — the rate limiter trips because the failing endpoint gets
hammered immediately by React Query's default retry policy on top of the 503. The 503 itself is
the real defect.

Most likely root cause: in local dev, the QZPay/MercadoPago billing layer is not reachable
(missing config, sandbox token mismatch, or DB tables not seeded with billing customers/plans
linkage). Coolify staging may behave differently — verify before assuming "broken everywhere".

##### **B-1. `/billing/payments` 503/429**

- **API:** `GET /api/v1/protected/billing/payments?` → 503 → 429.
- **Surface:** "Error al cargar pagos / Verifica que la API esté disponible".
- **Fix direction:** (1) On API side, root-cause why the billing route returns 503 in dev — check
  `MERCADO_PAGO_*` env, the QZPay adapter init in `apps/api/src/...`, the `billing_*` tables in DB.
  (2) On admin side, replace React Query's default retry with a backoff that does not trip the
  per-endpoint rate limit on consecutive failures: `retry: (n, e) => n < 1 && e.status >= 500`.
- **Acceptance:** With billing service properly configured, `/billing/payments` lists payments
  (empty if none seeded). Without configuration, the page shows the existing "Verifica que la API"
  message but does NOT trigger a 429 (only one 503 visible in network panel).

##### **B-2. `/billing/invoices` 503/429**

- **API:** `GET /api/v1/protected/billing/invoices?` → 503 → 429.
- Same root cause + fix as B-1. Likely closes together.
- **Acceptance:** Same shape as B-1.

##### **B-3. `/billing/settings` 503**

- **API:** `GET /api/v1/admin/billing/settings` → 503 (×2 retries, no 429 because admin-tier
  rate limit is more permissive).
- **Surface:** "Error al cargar la configuración / Billing service is not configured. Mostrando
  configuración por defecto" (graceful fallback exists).
- **Fix direction:** Same root-cause check as B-1. The endpoint is admin-tier so the schema is
  separate; verify both layers.
- **Acceptance:** `/billing/settings` shows the live billing settings (or, with billing intentionally
  disabled, the fallback message + a single 503 in network panel — no retry storm).

##### **B-4. `/sponsor/invoices` 503/429**

- **API:** `GET /api/v1/protected/billing/sponsor-invoices?` → 503 → 429 (same family as B-1/B-2).
- **Surface:** "Error al cargar facturas. Verifica que la API esté funcionando."
- Same fix as B-1.

##### **B-5. `/billing/promo-codes` 503/429 (already handled gracefully — only retry-storm fix needed)**

- **API:** `GET /api/v1/protected/billing/promo-codes?...` → 503 → 429.
- **Surface:** "No se pudieron cargar los códigos desde la API. Mostrando datos de ejemplo como fallback."
- Page already degrades gracefully. Only fix needed: the retry-policy change from B-1 (no 429 follow-up).
- **Acceptance:** Page shows fallback content with only one network 503 visible (no 429 retry).

---

#### I — i18n placeholder / English-text bleed (5 items)

##### **I-1. `*/new` page title leaks the literal `{entity}` placeholder**

- **Files:** Look at `apps/admin/src/components/entity-pages/EntityCreateContent.tsx` (the shared
  component used by every new page) and the i18n key it consumes (likely something like
  `entityPages.create.title`).
- **Confirmed surfaces:** `/destinations/new` ("Nuevo {entity} Destino"), `/events/new` ("Nuevo
  {entity} Evento"), `/posts/new` ("Nuevo {entity} Publicación"), `/access/users/new` ("Nuevo
  {entity} Usuario"). **All ~14 create pages share this component, all leak.**
- **Root cause hypothesis:** Title template is `t('common.create.title', { entity })` but either
  the key file uses `{entityName}` instead of `{entity}` (template/value mismatch), or the i18n
  call passes the wrong variable name. Single fix → all pages.
- **Fix direction:** Inspect the call site + the locale file; align placeholder name. Add a regression
  spec that asserts the rendered title for one create page does NOT contain `{`.
- **Acceptance:** No `*/new` page renders a literal `{entity}` (or `{entityName}` etc.) substring.

##### **I-2. Detail page header + action buttons in English on Spanish renderings**

- **Files:** `apps/admin/src/components/entity-pages/EntityViewContent.tsx` (or `EntityPageBase.tsx`).
- **Confirmed surfaces:** `/destinations/{id}` ("View Destino details / Back / Edit"),
  `/events/{id}`, `/access/users/{id}`. All detail pages share the component, all leak.
- **Root cause hypothesis:** Hardcoded `"View"`, `"Back"`, `"Edit"` strings (or English-only i18n
  keys with no Spanish translation, falling back to the default).
- **Fix direction:** Replace hardcoded strings with `t(...)` calls; ensure ES (and EN, PT) keys exist.
- **Acceptance:** Detail pages render header + action buttons in the active locale.

##### **I-3. `/access/roles` shows role names + descriptions in English (seed data leak)**

- **Files:** `apps/admin/src/routes/_authed/access/roles.tsx` reads role catalog; the catalog is
  seeded in `packages/seed/src/required/...`.
- **Surface:** "Complete system control", "User and role management", "Manages platform content,
  users, and most administrative functions" all visible on `/access/roles`.
- **Root cause hypothesis:** Role names + capabilities come straight from seed JSON, untranslated.
- **Fix direction:** Move role display names + descriptions out of seed data and into i18n keys
  (e.g. `roles.SUPER_ADMIN.name`, `roles.SUPER_ADMIN.description`, `roles.SUPER_ADMIN.capabilities[]`).
  The seed should produce only the **enum value** (`SUPER_ADMIN`); the admin UI resolves to the
  localized label via i18n.
- **Acceptance:** `/access/roles` renders role labels + capabilities in active locale.

##### **I-4. `/access/permissions` shows permission category names in English**

- **Files:** `apps/admin/src/routes/_authed/access/permissions.tsx`.
- **Surface:** "Permission", "User Bookmark", "Client Access Right", "Subscription Item" etc.
- **Root cause hypothesis:** Permission category labels derived from PermissionEnum string values
  (formatted via title-case). No i18n layer.
- **Fix direction:** Add `permissions.categories.<key>` i18n keys; resolve via `t(...)` in the page.
- **Acceptance:** Permission categories render in active locale.

##### **I-5. List-table column headers leak English ("Destination", "Owner", "Attractions")**

- **Files:** Column definitions in `apps/admin/src/features/<entity>/config/<entity>.columns.ts`.
- **Confirmed surfaces:** `/accommodations` ("Destination", "Owner"), `/destinations` ("Attractions").
- **Root cause hypothesis:** A handful of column `header` properties are static English strings
  instead of `t(...)` calls.
- **Fix direction:** Audit `columns.ts` per entity, replace string literals with i18n keys. Add a
  Biome rule (or a simple grep test) that flags non-i18n header strings in columns config.
- **Acceptance:** No English text in any list column header on Spanish renderings.

---

#### N — Newsletter (2 items)

##### **N-1. `/newsletter/campaigns` API returns 400 due to malformed `sort` parameter**

- **Files:** `apps/admin/src/routes/_authed/newsletter/campaigns/index.tsx` and the query hook in
  `apps/admin/src/features/newsletter/...`.
- **API:** `GET /api/v1/admin/newsletter/campaigns?page=1&pageSize=25&sort=desc` → 400. `sort=desc`
  alone is invalid — needs a field (`sort=createdAt:desc` or two params `sortBy=createdAt&sortDir=desc`,
  per the route's contract).
- **Fix direction:** Inspect the API route's `requestQuery` schema in `apps/api/src/routes/...newsletter/`
  to determine the correct shape; update the client query builder to match.
- **Acceptance:** `/newsletter/campaigns` lists campaigns (empty state if none) with no 400 in
  network panel.

##### **N-2. `/newsletter/subscribers` 503 on stats and list endpoints**

- **API:** `GET /api/v1/admin/newsletter/subscribers/stats` → 503 (×3),
  `GET /api/v1/admin/newsletter/subscribers?page=1&pageSize=25` → 503 (×3).
- **Surface:** Stuck on "Cargando suscriptores…".
- **Root cause hypothesis:** Newsletter service in dev is mis-configured (Brevo API key absent /
  invalid, or the upstream `BullMQ` worker used by SPEC-101 is not running locally and the route
  proxies through it).
- **Fix direction:** (1) Diagnose what the API logs say at the 503. (2) If it's dev-only config,
  document the local-dev requirements in `apps/api/CLAUDE.md` (or `packages/notifications` README).
  (3) Apply the same retry-policy fix from B-1 so failures don't retry-storm.
- **Acceptance:** `/newsletter/subscribers` either shows the subscribers (if reachable) or shows a
  clean "Servicio no disponible" message without retry storm.

---

#### M — Misc UX (3 items)

##### **M-1. `/accommodations/new` blocks SUPER_ADMIN with "Límite de alojamientos alcanzado"**

- **Files:** `apps/admin/src/routes/_authed/accommodations/new.tsx` and the gate hook (likely in
  `apps/admin/src/features/accommodations/hooks/...`).
- **Surface:** SUPER_ADMIN sees "Has alcanzado el límite máximo de alojamientos permitidos en tu
  plan actual. Actualiza tu plan para crear más alojamientos." with "Volver / Ver planes" buttons.
- **Root cause hypothesis:** The plan-limit gate evaluates against the current actor's billing
  plan without bypassing for admin roles. Operators with SUPER_ADMIN/ADMIN/CLIENT_MANAGER should
  always be able to create entities on behalf of any owner.
- **Fix direction:** Add a role check in the gate: if `actor.role` is in
  `[SUPER_ADMIN, ADMIN, CLIENT_MANAGER]`, skip the limit check.
- **Acceptance:** SUPER_ADMIN sees the create form on `/accommodations/new`. Non-admin owners
  still see the limit gate when at the cap.

##### **M-2. React Query retries 4× on 500 errors, amplifying every API failure**

- **Scope:** Visible across all A* findings (every 500 produces 4 visible network entries).
- **Root cause:** Default React Query `retry: 3` policy applies to all errors, including
  permanent ones (500s and schema-mismatches will not succeed on retry).
- **Fix direction:** In the QueryClient config (likely `apps/admin/src/lib/query-client.ts`),
  set a smarter default:
    ```ts
    retry: (failureCount, error) => {
        if (failureCount >= 1) return false;
        if (error instanceof ApiError && error.status >= 500) return false;
        if (error instanceof ApiError && error.status === 429) return false;
        return failureCount < 2; // network errors only
    }
    ```
- **Acceptance:** API 500s appear once in the network panel (not 3-4 times). 429s do not retry.
  Network errors still retry.

##### **M-3. `/analytics/debug` health checks render "unknown / N/A"**

- **Files:** `apps/admin/src/routes/_authed/analytics/debug.tsx`.
- **Surface:** "Estado de la API: N/A unknown" and "Estado de la Base de Datos: Pool de conexiones unknown".
- **Root cause hypothesis:** The health-check endpoints are not wired up (or hardcoded to return
  unknown). Lower priority — diagnostic page only.
- **Fix direction:** Wire `/api/v1/admin/health` and `/api/v1/admin/health/db` (or whatever
  endpoints the API exposes); update `analytics/debug.tsx` to call them.
- **Acceptance:** Both indicators show real status. If endpoints don't exist yet, file a follow-up
  spec for the API side; mark this finding deferred.

---

#### D — CRUD operation verification (per main entity)

> **Status: to be populated by the Discovery Phase (§6 → Phase Discovery → T-024..T-036).**
> The list of entities to smoke is fixed below; the per-entity D-N.X findings are NOT —
> they are written here only after their smoke runs in `docs/admin-crud-smoke/<entity>.md`
> are complete.

The original audit only navigated to pages and inspected console + network. It did NOT exercise
**Save / Create / Delete / Restore** buttons. Each entity below gets a dedicated end-to-end smoke
test (see §8 for the per-entity checklist) and any defect surfaced becomes a numbered finding
inside its row.

The 17 main entities under test:

| ID | Entity | Routes covered |
|---|---|---|
| D-1 | accommodations | `/accommodations`, `/accommodations/new`, `/accommodations/{id}`, `/accommodations/{id}/edit` |
| D-2 | destinations | `/destinations`, `/destinations/new`, `/destinations/{id}`, `/destinations/{id}/edit` |
| D-3 | events | `/events`, `/events/new`, `/events/{id}`, `/events/{id}/edit` |
| D-4 | event-locations | `/events/locations[/...]` (4 routes) |
| D-5 | event-organizers | `/events/organizers[/...]` (4 routes) |
| D-6 | posts | `/posts[/...]` (4 routes) |
| D-7 | users | `/access/users[/...]` (4 routes) |
| D-8 | sponsors | `/sponsors[/...]` (4 routes) |
| D-9 | accommodation-amenities | `/content/accommodation-amenities[/...]` (4 routes) |
| D-10 | accommodation-features | `/content/accommodation-features[/...]` (4 routes) |
| D-11 | destination-attractions | `/content/destination-attractions[/...]` (4 routes) |
| D-12 | tags-internal | `/tags/internal[/...]` (3 routes — no `$id.tsx` view) |
| D-13 | tags-post-tags | `/tags/post-tags[/...]` (3 routes) |
| D-14 | tags-system | `/tags/system[/...]` (3 routes) |
| D-15 | sponsorships | `/billing/sponsorships`, create/edit/delete via dialog |
| D-16 | owner-promotions | `/billing/owner-promotions`, create/edit/delete via dialog |
| D-17 | newsletter-campaigns | `/newsletter/campaigns[/...]` |

For each entity, the per-finding format is:

```
##### D-N.X. <symptom> on <entity> <operation>
- Files / route: ...
- Steps to reproduce: ...
- Root cause hypothesis: ...
- Fix direction: ...
- Acceptance: ...
```

The smoke runs are tracked as tasks T-024..T-040 in §3. Each smoke produces 0 or more D-N.X
findings, which then get fixed in Phase 6 (Functional CRUD).

**Predicted blockers (still valid for the entities NOT yet smoked):**

- **D-7.1 (HIGH, dependent on A-1):** `/access/users` list 500 will block the user CRUD smoke.
- **D-6.1 (HIGH, dependent on A-2):** Same for posts.
- **D-12.1, D-13.1, D-14.1 (HIGH, dependent on A-3..A-5):** tags-internal, post-tags, system.
- **D-1.1 (MEDIUM, dependent on M-1):** Cannot create accommodation while plan-limit gate blocks SUPER_ADMIN.
- **D-1.2 (MEDIUM, dependent on A-6):** Cannot edit accommodation while detail endpoint 500s.

These shape Discovery order: unblocked smokes first; blocked smokes wait for their A-* fix to
land in Implementation Phase 1.

#### Discovered D-* findings (from completed smokes T-024..T-031, T-026)

Six entities smoked. Reports under `docs/admin-crud-smoke/<entity>.md`. Findings below.

##### **D-2.1 🔴 CRITICAL — Form fields with id `field-X.Y` (dot notation) are write-protected (CROSS-CUTTING)**

- **Symptom:** any input/textarea whose `id` contains a `.` cannot accept input through ANY
  mechanism — not via Chrome DevTools `fill`, not via `Object.getOwnPropertyDescriptor(...).set` +
  dispatched events, not via simulated keystrokes.
- **Surface:** Confirmed broken on `field-location.country`, `field-location.state`,
  `field-location.city`, `field-location.zipCode`, `field-location.coordinates.lat`,
  `field-location.coordinates.long`, `field-date.start`, `field-date.end`, `field-pricing.price`,
  `field-contact.email`, `field-contact.phone`, `field-contact.website`. Confirmed working on
  ALL flat ids without `.` (e.g. `field-name`, `field-slug`, `field-summary`, `field-description`).
- **Pattern:** the bug applies to every entity form whose schema models nested fields. **Affected
  entities (confirmed):** destinations (Location section), events (Fecha y Precios + Contacto +
  Ubicación sections). **Affected (predicted, unsmoked):** accommodations, posts, sponsors —
  any entity with nested location, contact, pricing, or date fields.
- **Suspected root cause:** the shared `EntityFormField` (or a Controller wrapper around it)
  uses dot-path keys to bind to React Hook Form, but the wrapper either ignores DOM input events
  on those nested fields or re-resets them on every render via stale-state binding. ALSO possibly
  related: the `fill` operation in chrome-devtools succeeds visually but never dispatches React's
  synthetic event for these wrapped controls.
- **Files to investigate:** `apps/admin/src/components/entity-form/EntityFormField.tsx`,
  `apps/admin/src/components/entity-form/EntityFormSection.tsx`, and any `Controller` wrappers
  around nested fields. Likely root in how `path` is split for `useController({ name })` when
  the name contains a `.`.
- **Fix direction:** ensure nested-name controllers properly hook RHF `register` AND `setValue`
  on every `onChange`. Add a unit test that asserts setting `field-location.country` via DOM
  input event reflects in `getValues().location.country`.
- **Acceptance:** Typing into ANY nested form field reflects in the field's `el.value` and
  persists through submission. Smoke runs T-024 (destinations) and T-025 (events) succeed past
  step 2.

##### **D-2.2 🟠 HIGH — Form discards unsaved input when focus moves to a `<combobox>`**

- **Symptom:** when typing into a textbox without first blurring, then clicking a combobox in
  the same form, the textbox value is **reset to empty** on the re-render that follows the
  combobox open.
- **Surface:** observed on `/destinations/new` Resumen / Descripción after clicking the
  Visibilidad combobox. Likely also affects every consolidated-section form.
- **Suspected root cause:** controlled inputs whose `value` prop is bound to an RHF controller
  that only `setValue` on `blur`, not on `change`. When the combobox click triggers a re-render
  the controlled input re-mounts with stale (empty) form state.
- **Fix direction:** switch the textbox controller to `setValue` on every `onChange` (not just
  `onBlur`), or preserve in-progress value in local component state until `onBlur`.
- **Acceptance:** clicking any combobox preserves all in-progress textbox values.

##### **D-4.1 🔴 CRITICAL — `event-locations/new` form does not collect required `destinationId`**

- **Symptom:** POST `/api/v1/admin/event-locations` rejects with `VALIDATION_ERROR` /
  `field: "destinationId"` / `messageKey: "zodError.common.id.required"`. The form has no UI
  control for `destinationId`.
- **Suspected root cause:** form/schema drift — `destinationId` was added as required in the
  schema but the form config in `apps/admin/src/features/event-locations/config/sections/...`
  was never updated.
- **Fix direction:** add a `<DestinationSelect>` field to the form (component already exists
  in `apps/admin/src/components/selects/`).
- **Acceptance:** form shows a Destino dropdown, submission succeeds.

##### **D-4.4 🟡 MEDIUM — Inconsistent address-modeling between `event-locations` and `destinations`**

- `/events/locations/new` uses **flat** ids: `field-street`, `field-city`, `field-country`.
- `/destinations/new` uses **nested** ids: `field-location.street`, `field-location.city`,
  `field-location.country`.
- Both forms model "address" but with different conventions. Pick one (preferably nested for
  consistency with the schema model) and apply to both. Note: D-2.1 must be fixed first or the
  unification will spread the dot-notation bug to event-locations.

##### **D-CONTENT.1 🟠 HIGH — `accommodation-amenities`, `accommodation-features`, `destination-attractions` have NO delete UI**

- **Symptom:** detail pages expose only "Back" + "Edit" buttons; list rows expose only "View
  amenity/feature/attraction". No delete affordance anywhere — operators cannot remove a created
  row through the admin UI.
- **Surface:** confirmed across all 3 "content" entities (D-9.1, D-10.1, D-11.1 are duplicates
  of this single root finding).
- **Suspected root cause:** the per-entity feature config (`apps/admin/src/features/<entity>/`)
  does not declare delete actions on the row config or the detail action bar. Likely a single
  config option (`enableDelete: true`) missing from the three configs OR a default in the shared
  EntityPageBase that needs flipping.
- **Fix direction:** add "Eliminar" action button on the detail page (with confirmation dialog)
  AND a row action in the list table. The delete should call existing
  `DELETE /api/v1/admin/<entity>/{id}`. Verify whether soft-delete is supported (check
  `<entity>` table schema for `deleted_at`).
- **Acceptance:** SUPER_ADMIN can soft-delete (or hard-delete if soft not supported) any row of
  amenities, features, attractions from the UI.

##### **D-TOAST.1 🟢 LOW — Toast notifications use the same string for title AND body**

- **Symptom:** every toast renders as e.g. `"Comodidad creado exitosamente: Comodidad creado
  exitosamente"` — title and body are identical. Same on error toasts: `"Error al crear
  Ubicación: Error al crear Ubicación"`.
- **Surface:** confirmed on amenities (success), features (success), attractions (success),
  event-locations (error). Pattern.
- **Suspected root cause:** the toast helper takes 2 string args (title + description) but
  callers pass the same value to both, OR a single template `t('entity.create.success')` is
  passed twice.
- **Fix direction:** define separate i18n keys for title and description. Title = generic
  ("Creado", "Error"); description = entity-specific.
- **Acceptance:** title and description differ in every toast.

##### **D-TOAST.2 🟢 LOW — Toast text uses wrong gender**

- **Symptom:** "Comodidad **creado** exitosamente" (Comodidad is feminine → should be "creada"),
  same for "Característica creado", "Atracción creado".
- **Surface:** every entity whose name is feminine in Spanish.
- **Suspected root cause:** template hardcodes masculine "creado" instead of using a
  per-entity i18n key.
- **Fix direction:** per-entity i18n keys for the verb (`creado` vs `creada`), or a generic
  `entity.create.success` key per entity that has the right gender baked in.
- **Acceptance:** Spanish toasts use the correct gender for each entity name.

##### **D-NAMING.1 🟢 LOW — Entity name flips between "Comodidad" / "Amenidad" / "Amenities" within the same product surface**

- **Symptom:** sidebar nav says "Amenidades", page heading says "Nuevo {entity} Comodidad",
  submit button says "Crear Comodidad", DB table is `amenities`, schema is "Amenities".
- **Suspected root cause:** different translation keys + raw schema names + nav labels were
  authored independently.
- **Fix direction:** product decision: pick "Amenidades" (most user-facing) and apply to all
  surfaces. Update nav, headings, submit, list-page title, toast text.
- **Acceptance:** the same entity name appears everywhere.

##### **D-DROPDOWN.1 🟡 MEDIUM — Some enum dropdown values render in English**

- **Symptom:** `Visibilidad` combo on `/destinations/new` shows `Public / Private / Restricted`
  (English). Other combos on the same form (`Tipo de Destino`, `Estado del Ciclo de Vida`)
  correctly show Spanish (`Ciudad / Borrador / Activo / ...`).
- **Surface:** combobox-by-combobox; needs an i18n sweep across all entity forms.
- **Suspected root cause:** enum option labels are sometimes hardcoded (English) instead of
  going through `t('common.enums.<enumName>.<value>')`.
- **Fix direction:** sweep the form configs; replace any hardcoded enum labels with i18n calls.
  Belongs to the I-* family — file as I-6.

##### **D-DISPLAYWEIGHT.1 🟢 LOW — `field-displayWeight` is `<input type="text">` not `type="number"`**

- **Symptom:** Peso de Visualización field documented "1-100" but rendered as text input. No
  client-side range validation. Server may catch it but the UI doesn't.
- **Surface:** amenities, features, attractions.
- **Fix direction:** change to `type="number"` with `min="1" max="100"`. Or add a `<NumberInput>`
  shared component.

##### **D-EDIT.HEADER 🟢 LOW — Edit page header in English ("Edit X" / "Modify X details" / "View" / "Cancel")**

- Confirmed on `/<entity>/{id}/edit`. Same pattern as I-2 (detail page English bleed).
- Action buttons: `View / Cancel / Guardar cambios` — mixed Spanish + English in the same bar.
- File: same component family as I-2 (`EntityPageBase` / `EntityViewContent` / `EntityEditContent`).

##### **D-8.1 🔴 CRITICAL — Sponsor `Create` shows success toast + redirect, but row is NOT persisted (data-loss / ghost-create)**

- **Symptom:** Submit Create form on `/sponsors/new` → success toast "Patrocinador creado
  exitosamente" → redirect to `/sponsors/<uuid>` → reload that URL: 404, row NOT in DB.
- **Surface:** confirmed on sponsors. Possibly affects other entities — needs verification on
  every entity whose smoke "passed Create" so far (amenities, features, attractions). For those
  three the DB query returned the row, so they ARE persisted; sponsors is the first entity
  observed to lie.
- **Suspected root cause:** the `useCreate` mutation (or its `onSuccess` handler in the sponsors
  feature) treats the response as success before commit, OR the API returns 200/201 with a
  fabricated id without persisting. Could also be that the response uses a different id key than
  the route reads (`id` vs `data.id`).
- **Fix direction:** capture the POST `/api/v1/admin/post-sponsors` response body and verify it
  matches what's persisted. Add an integration test that POSTs sponsors and asserts persistence.
- **Acceptance:** creating a sponsor produces a row in `post_sponsors` with the same id shown in
  redirect URL; reload the detail page works.

##### **D-5.1 🔴 (CONFIRMS D-2.1) — `event-organizers/new` 12 dot-notation contactInfo + socialNetworks fields all blocked**

- 12 fields (`field-contactInfo.*` + `field-socialNetworks.*`) blocked by D-2.1. Required
  `field-contactInfo.mobilePhone` makes the smoke un-submittable.
- Single root cause shared with D-2.1; no separate fix required.

#### D — Smokes still pending (will produce additional D-N.X findings during Phase 6)

| ID | Entity | Status | Blocker |
|---|---|---|---|
| T-027 | event-organizers | not run | (likely repeats D-CONTENT.1 + D-TOAST.* patterns; expected PARTIAL) |
| T-028 | sponsors | not run | (likely has location/contact → D-2.1 will trigger; expected BLOCKED or PARTIAL) |
| T-032 | users (D-7) | blocked by A-1 | run after Implementation Phase 1 |
| T-033 | posts (D-6) | blocked by A-2 | run after Implementation Phase 1 |
| T-034 | tags-internal/post-tags/system (D-12..14) | blocked by A-3..A-5 | run after Implementation Phase 1 |
| T-035 | accommodations (D-1) | blocked by M-1 + A-6 | run after Implementation Phase 5 + 3 |
| T-036 | sponsorships / owner-promotions / newsletter-campaigns | not run | (covered by B-* and N-* in baseline; smokes pending) |

---

#### V — Visual / Style audit

> **Status: to be populated by the Discovery Phase (§6 → Phase Discovery → T-041).**
> The methodology + checklist below are fixed; the V-N rows are added only after the visual
> baseline screenshot pass produces them.

This category captures defects that are **purely visual** — spacing, sizing, alignment, padding/margin
consistency, elements that touch or overlap, typography hierarchy, and viewport responsiveness.
The methodology is in §9.

The audit produces a **baseline screenshot library** at `docs/admin-pages-audit-screenshots/` with
this structure:

```
docs/admin-pages-audit-screenshots/
├── before/
│   ├── 1280x800/
│   │   ├── dashboard.png
│   │   ├── accommodations-list.png
│   │   ├── accommodations-detail.png
│   │   ├── ...
│   ├── 768x1024/
│   ├── 375x667/
│   └── dark-mode/  (subset, dashboard + 2 list + 2 form)
└── after/  (same structure, populated post-fix)
```

For each defect found, a finding row is added below in the format:

```
##### V-N. <symptom> on <route(s)>
- Viewport(s) where visible: 1280, 768, 375, dark
- Screenshot ref: docs/admin-pages-audit-screenshots/before/<viewport>/<file>.png
- Root cause: hardcoded px / missing token / wrong utility class / etc.
- Fix direction: ...
- Acceptance: visual diff against fixed screenshot at all listed viewports
```

**Severity tiers within V:**

- 🔴 **V-CRIT**: layout completely broken (overflow, overlap blocks click target, text illegible)
- 🟠 **V-HIGH**: clearly wrong (form fields different sizes in same form, header out of grid,
  inconsistent card padding within the same page)
- 🟡 **V-MED**: noticeable but non-blocking (minor spacing inconsistency, color drift)
- 🟢 **V-LOW**: cosmetic polish (font weight tweak, hover state subtly off)

**Baseline categories to assert (the checklist becomes the per-finding source):**

- Spacing tokens: every padding/margin uses the Tailwind spacing scale (no `padding: 13px` literals).
- Card consistency: all `<Card>` instances on a single page share padding, border-radius, shadow
  treatment.
- Form field consistency: all inputs in a single form share height, label gap, helper-text size.
- Typography hierarchy: at most one `<h1>` per page; `<h2>` for section heads; `<h3>` for sub-blocks.
- Touch targets ≥ 44×44px on mobile (WCAG 2.5.5).
- No element overlaps another at any tested viewport.
- Sidebar / topbar align with the main content gutter on resize.
- Empty states + loading skeletons match the table/grid they replace (no layout jump).
- Action buttons: primary on the right, secondary on the left, destructive isolated, all consistent
  across pages.
- Modal/Dialog: consistent width tier (sm/md/lg) per use-case; close button always top-right;
  no two modals stacked.

**Suspect surfaces to inspect first (hints from the original audit, NOT yet confirmed defects):**

- Filter chips on `/destinations` and `/accommodations` — confirm chip spacing + active state.
- The "Cargando…" placeholder mixed with real-looking column headers (`/events`, `/destinations`) —
  visually confusing.
- "Página 1 de 6" + empty pagination footer when list returns 0 rows looks broken.
- Sidebar "Secondary navigation" expands/collapses with no animation on click.
- Card grid on `/access/permissions` (58 categories) — verify wrapping behavior at 768px.

#### Discovered V-* findings (from T-041 baseline screenshots)

Screenshots saved under `docs/admin-pages-audit-screenshots/before/{1280x800,375x667}/`.
7 priority pages captured (5 desktop, 2 mobile). Defects below.

##### **V-1 🟠 HIGH — Dashboard "Attractions" + "Users" cards have inconsistent style vs the 4 main stat cards**

- **Surface:** `/dashboard` at all viewports.
- **Defect:** the dashboard shows 4 stat cards in row 1 (Alojamientos / Destinos / Eventos / Publicaciones) with Phosphor icons + colored borders + Spanish labels + uniform padding. Below, two more cards (Attractions, Users) appear with NO icons, NO border-color, plain padding, and **English labels**. The two card families look like they came from different designs.
- **Suspected root cause:** Attractions + Users cards are a separate component (or hardcoded elsewhere) added after the main stats grid. Probably a "we'll align this later" placeholder.
- **Fix direction:** Refactor Attractions + Users to use the same `<StatCard>` component as the main 4. Localize labels.
- **Acceptance:** All 6 cards visually identical (icons, borders, paddings, label language).

##### **V-2 🟠 HIGH — FAB (feedback) + decorative "palmera" image obstruct content on mobile**

- **Surface:** `/dashboard` at 375×667 (and likely all admin pages on mobile).
- **Defect:** The Feedback FAB (purple round button) sits at `position: fixed; bottom: ~30%` (NOT bottom: 0) in the screenshot, overlapping the "Eventos" card label/value. Additionally a colored "palmera" graphic appears beside it, also obstructing card content.
- **Suspected root cause:** the FAB's mobile bottom-offset is intentional to clear the cookie banner on the public site, but on admin (no cookie banner) the offset puts it mid-screen. The "palmera" graphic is unidentified — could be a misplaced decorative asset or a bug in z-index.
- **Fix direction:** (a) On admin routes, drop the FAB to `bottom: 16px`. (b) Identify and remove or hide the palmera graphic from admin routes.
- **Acceptance:** FAB sits at the bottom-right corner, no overlap with content. Palmera does not appear on admin pages.

##### **V-3 🟡 MEDIUM — Filter dropdowns on `/accommodations` mobile show only "Todos" without the filter name**

- **Surface:** `/accommodations` (and likely all list pages) at 375×667.
- **Defect:** 4 dropdowns stacked vertically all reading "Todos" — the user has no way to know which filter (Estado / Tipo / Destacado / Mostrar eliminados) each one controls until they click. On desktop the field has a label inside the trigger ("Estado: Todos"), but on mobile the label disappears.
- **Fix direction:** Either keep the label-prefix ("Estado: Todos") on mobile, or render an explicit `<label>` above each dropdown.
- **Acceptance:** Each filter trigger on mobile clearly identifies which dimension it controls.

##### **V-4 🟠 HIGH — Form Resumen field on `/destinations/new` has the FAB overlapping the textarea**

- **Surface:** `/destinations/new` at 1280×800.
- **Defect:** The Feedback FAB appears at `bottom-right` of the visible viewport, but at the moment of capture it sits VISIBLY OVER the right edge of the "Resumen" textarea. The FAB is not respecting safe areas around content.
- **Fix direction:** Same as V-2 — review FAB positioning across admin routes. May also need a `right: 16px` floor that respects scrollbar gutter.
- **Acceptance:** FAB never visually overlaps form controls in normal use.

##### **V-5 🟢 LOW — Permissions categories all in English on Spanish-locale page**

- **Surface:** `/access/permissions` at 1280×800.
- **Defect:** 6 category groups have Spanish headers (Gestión de Contenido, Usuarios y Acceso, ...) but the items inside each are in English ("Accommodation", "Permission", "User Bookmark", "Subscription Item", "Ad Pricing Catalog", etc.).
- **Cross-ref:** I-4 in §4 (already known). V-5 is the visual confirmation.

##### **V-6 🟡 MEDIUM — `/access/permissions` cards show no item count or visual indicator of "expandable"**

- **Surface:** `/access/permissions` at 1280×800.
- **Defect:** Each category group has a `chevron-down` icon implying expandable, but cards are already expanded; clicking does nothing (or it's not obvious they collapse). The "7" / "11" counts are shown as plain numbers, not as badges.
- **Fix direction:** if cards are NOT expandable, remove the chevron. If they ARE, add a hover state and animate the chevron rotation.

##### **V-7 🟢 LOW — Sidebar takes ~30% of viewport at 1280×800; could be narrower**

- **Surface:** all admin pages at 1280×800.
- **Defect:** the secondary navigation sidebar is approximately 230-260px wide. On a 1280-wide viewport that leaves ~1020px for content, which is OK for tables but cramped for forms with side-by-side fields. Also notable: the "Crear Nuevo" sub-items in the sidebar duplicate the "Crear" buttons that already exist in the main content area — opportunity to consolidate.

**More V-* findings will be discovered if visual sweep is extended to 768x1024 + dark-mode + remaining priority pages.** Current baseline is 7 pages × 2 viewports. Recommended to extend to 12-15 pages × 4 viewports for full coverage.

**All other V-N findings populate here during T-043 (post-Discovery spec update).**

---

#### CE — Console errors / warnings sweep

> **Status: to be populated by the Discovery Phase (§6 → Phase Discovery → T-042).**
> The triage rules below are fixed; the CE-N rows are added only after the console sweep
> across every admin route.

Every page navigated during D-* smoke and V-* visual passes is also screened for console output.
Each unique error or warning is logged and triaged.

**Triage categories:**

1. Already covered by an existing A/B/C finding → cross-reference, no new finding needed.
2. New defect not in §4 yet → add a CE-N row.
3. Third-party library noise (e.g. React 19 deprecation warnings, TanStack Devtools, Better Auth
   debug output in dev) → document the source and either suppress or accept.
4. Hydration mismatch / strict-mode double-render artifacts → log; treat any production-mode
   reproduction as a CE-* defect.

**Format per CE finding:**

```
##### CE-N. <message> at <route>
- Frequency: every navigation / first nav only / specific action
- Source file: <stack trace top frame>
- Triage: 1/2/3/4 above
- Fix direction: ... (only if category 2)
- Acceptance: error no longer logged in console under normal navigation
```

**Initial known console errors (from original audit, reproduced here for completeness):**

- **CE-A.1** `Failed to load resource: 500` — covered by A-1..A-6.
- **CE-A.2** `ApiError: Response payload does not match declared schema` — covered by A-1..A-6.
- **CE-A.3** `TypeError: Cannot read properties of undefined (reading 'reduce')` — covered by C-1, C-2.
- **CE-A.4** `TypeError: configs.map is not a function` — covered by C-3.
- **CE-A.5** `Uncaught Error: There was an error during concurrent rendering but React was able
  to recover...` — downstream of C-1/C-2/C-3.

#### Discovered CE-* findings (continuous capture across smokes + visual sweep)

##### **CE-1 (CONFIRMS C-cluster) — `TypeError: Cannot read properties of undefined (reading 'reduce')`**

Observed on `/billing/addons`, `/billing/subscriptions`, `/billing/plans`. Single shared root
cause. Already covered by C-1, C-2, C-4.

##### **CE-2 (CONFIRMS A-cluster) — `ApiError: Response payload does not match declared schema`**

Observed on dashboard counter requests for users/posts, on `/access/users`, `/posts`,
`/tags/internal`, `/tags/post-tags`, `/tags/system`, `/accommodations/{id}` detail. Already
covered by A-1..A-6.

##### **CE-3 — `Failed to load resource: the server responded with a status of 400`**

Observed on `/newsletter/campaigns` (sort param), `/events/locations` create POST (missing
destinationId). Already covered by N-1 + D-4.1.

##### **CE-4 — `Failed to load resource: the server responded with a status of 503/429`**

Observed on multiple billing protected routes. Already covered by B-1..B-5.

##### **CE-5 — `Failed to load resource: 404`**

Observed on `/sponsors/<smoke-uuid>` after a "successful" create that did not persist. Covered
by D-8.1.

##### **CE-6 — Vite dev-mode warnings (third-party, category 3 — accept and document)**

- `vite-tsconfig-paths` plugin recommended to be removed (Vite native support).
- `optimizeDeps.rollupOptions` deprecated; use `optimizeDeps.rolldownOptions`.
- `@vitejs/plugin-react` recommends switching to `@vitejs/plugin-react-oxc`.

These appear on every dev server start. Document in `apps/admin/CLAUDE.md` Common Gotchas as
"accepted dev-only noise". Out of scope for this spec to fix the underlying suggestions.

##### **CE-7 — Better Auth session-data cookie warning (none observed)**

Confirmed clean — no Better Auth warnings observed during smoke.

##### **CE-8 — TanStack Devtools button always visible in production-like dev**

Cosmetic — the "Open TanStack Devtools" button appears at bottom-left of every admin page in
dev. Not a defect; documented for awareness.

**No new category-2 (real defect) CE-* findings beyond what A/B/C/D/I/M/N already cover.**

**All other CE-N findings populate here during T-046 (post-Discovery spec update).**

---

## Part 2 — Technical Approach

### 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Fixing A-1 to A-5 by **stripping** fields from service output to match the schema (instead of extending the schema) | medium | high — silent data loss in admin views, downstream consumers break | Always reconcile by **extending the schema** unless the field is genuinely accidental. Add a contract test per affected entity in `apps/api/test/routes/admin/...`. |
| C-1/C-2/C-3 fix touches a shared hook used outside billing/revalidation | medium | medium — fix could mask a real upstream bug | Don't blindly default to `[]` — verify the source of the `undefined` and either fix the source or default at the consumer with a TODO comment pointing to the source bug. |
| B-* "fix" hides a real misconfiguration that production also has | low-medium | high — reverts a real outage warning | Document in `apps/api/CLAUDE.md` exactly which env / DB state the billing layer needs locally; don't make 503s "graceful" if they're a true misconfiguration on staging/prod. |
| I-3 (roles seed → i18n) is a wide blast-radius migration touching seed JSON + service tests | medium | medium — breaks role-related tests in `service-core` | Stage in two PRs: (1) move strings to i18n + admin reads from i18n, (2) clean seed JSON. |
| M-1 (admin bypass for plan-limit) silently bypasses limits for paid features | low | high — could lead to non-admin users with elevated roles bypassing billing | Restrict to specific roles (`SUPER_ADMIN`, `ADMIN`, `CLIENT_MANAGER` if applicable); add a unit test on the gate logic. |
| Visual audit (V-*) explodes scope — every page reveals 5-10 small defects | high | medium — spec drifts into a "polish everything" megaproject | Hard-cap V-* in-spec to V-CRIT + V-HIGH only. V-MED and V-LOW move to a follow-up "admin polish" spec. Document this rule in §4 (V) and enforce at triage (T-043). |
| CRUD smokes (D-*) discover dozens of new D-N.X bugs that bury the spec | medium | medium — closeout slips | Triage at T-037: split D-N.X into "in-scope" (data integrity, lifecycle bugs) vs "follow-up" (UX polish, missing features). Don't fix non-critical D-N.X here. |
| Screenshot library (`docs/admin-pages-audit-screenshots/`) bloats the repo | high | low — repo size grows ~50-100MB | Use PNG-optimized screenshots (`pngquant`), organize by viewport, and consider Git LFS or `.gitignore`-ing `before/` after closeout (keeping only `after/` as the "current" baseline). Decide at T-041. |

### 6. Phased Delivery Plan

The work is grouped into a clear separation between **Discovery** (no code-fix work; produces
findings + spec updates) and **Implementation** (closes findings). The boundary between the two
is a **spec update checkpoint** — implementation does NOT begin on D / V / CE until the spec
has been updated with the concrete findings.

#### Stage 0 — Pre-existing (already shipped on this branch)

- A1 — kysely shim (apps/admin/src/lib/kysely-shim.mjs + vite.config.ts alias)
- A2 stays as a documentation task — tracked in Implementation Phase 5 below.
- Original audit completed in `docs/admin-pages-audit-report.md`.

#### Stage Discovery — Smoke + Visual + Console sweeps (BEFORE implementation)

Discovery is a single phase, but split into 3 parallel workstreams. Each workstream produces
**output artifacts**, NOT code fixes. Output of the entire Discovery is a fully-populated §4
of this spec.

- **D.1 (CRUD smokes for unblocked entities):** Run T-024..T-031 + T-036 against the entities
  whose LIST endpoints already work (destinations, events, event-locations, event-organizers,
  sponsors, amenities, features, attractions, sponsorships, owner-promotions, newsletter-campaigns).
  Each smoke produces `docs/admin-crud-smoke/<entity>.md` and 0..N D-N.X candidate findings.
- **D.2 (Visual baseline):** Run T-041 — take full-page screenshots of every priority page at
  1280×800, 768×1024, 375×667, plus dark-mode subset. Save under
  `docs/admin-pages-audit-screenshots/before/...`. Inspect for V-* defects per §9 checklist.
- **D.3 (Console sweep):** Run T-042 — walk every route with DevTools console open. Triage every
  unique error/warning per §4 CE rules. Append findings to `docs/admin-pages-audit-report.md`
  in a new "Console Sweep" section.

The CRUD smokes for blocked entities (T-032..T-035 covering users, posts, tags, accommodations)
DO NOT run during Discovery — they wait until Implementation Phase 1 unblocks their LIST routes.
This is captured in dependencies (§ Part 3 task table).

#### Stage Discovery → Spec Update Checkpoint (mandatory gate)

After D.1 + D.2 + D.3 finish, update §4 of this spec **in place** with all concrete findings
(D-N.X, V-N, CE-N) discovered. This is task **T-037 (spec update for D)** + **T-043 (spec
update for V)** + **T-046 (spec update for CE)** — three explicit tasks, each one a checkpoint
that produces a commit on this branch.

**No Implementation work on D/V/CE starts until these three updates land.** Implementation
on A/B/C/I/M/N can run **in parallel** with Discovery (it's discovering against the same
broken state — that doesn't change).

Once the spec is updated, the operator should:

1. Re-read §4 to confirm scope is accurate.
2. Re-evaluate `effort_estimate_hours` in metadata.json — adjust if the new findings substantially
   exceed or undershoot the 48-72h envelope.
3. Decide which V-* + D-N.X findings are in-scope for this spec vs. follow-up specs. Apply the
   §5 "Visual audit V-CRIT + V-HIGH only" hard cap.
4. Once committed, Implementation phases for D/V/CE proceed.

#### Stage Implementation — Phase 1: Unblock admin LIST views (highest user impact)

- A-1 (users), A-2 (posts), A-3 (tags/internal), A-4 (posts/tags), A-5 (tags/system) — same
  procedure, possibly the same shape of fix in `@repo/schemas`.
- Also includes **adding contract tests** to prevent recurrence.
- **Order:** Diagnose ONE (e.g., A-1) end-to-end first; once the pattern is understood, apply to the
  remaining 4 in parallel.
- **Unblocks:** D.1 smokes for users, posts, 3× tags can run after this lands.

#### Stage Implementation — Phase 2: Stop client crashes

- C-1 (billing/addons), C-2 (billing/subscriptions), C-3 (revalidation) — likely 2 distinct fixes
  (C-1 + C-2 share signature; C-3 is independent).

#### Stage Implementation — Phase 3: Detail-view 500 + retry storm

- A-6 (accommodations/{id}) — same procedure as A-1..A-5 but for `getById` schema.
- M-2 (React Query retry policy) — single fix, large quality-of-life win across the whole audit.
- **Unblocks:** D.1 smoke for accommodations (also needs M-1).

#### Stage Implementation — Phase 4: i18n cleanup

- I-1 (placeholder leak in EntityCreateContent) — single fix, ~14 pages.
- I-2 (detail header English bleed) — single fix in EntityViewContent / EntityPageBase.
- I-5 (column headers) — sweep `<entity>.columns.ts` files.
- I-3 + I-4 (roles + permissions catalog → i18n) — bigger refactor; can land as a follow-up commit.

#### Stage Implementation — Phase 5: Billing connectivity & dev ergonomics

- B-1, B-2, B-3, B-4, B-5 (billing 503/429) — diagnose dev-side first, then either fix env config
  or document. Apply M-2 retry policy to suppress 429 cascades.
- N-1 (campaigns sort param), N-2 (subscribers 503) — analogous.
- M-1 (plan-limit bypass for admin roles) — small, isolated.
- A2 follow-through: either add `pnpm turbo build --filter='admin^...'` to `dev-admin.js` or alias
  the remaining workspace packages.

#### Stage Implementation — Phase 6: CRUD smoke continuation + D-N.X fixes

- Run the smokes that were blocked during Discovery (T-032..T-035 — users, posts, tags,
  accommodations) now that Implementation Phases 1-5 unblocked their dependencies.
- **Update §4 of this spec again** with the additional D-N.X findings discovered.
- Triage all D-N.X (from Discovery + this batch) per the §5 risk-mitigation rule (in-scope =
  data integrity, lifecycle bugs; out-of-scope = UX polish, missing features).
- Fix in-scope D-N.X findings.
- Re-run the affected smokes; record green outcomes.

#### Stage Implementation — Phase 7: Fix V-CRIT + V-HIGH

- Fix V-CRIT findings from §4 (V section, populated by Discovery + T-043 update).
- Fix V-HIGH findings.
- Re-screenshot to `after/`; visual-diff against `before/`.

#### Stage Implementation — Phase 8: Fix CE-* findings

- Fix all CE-* findings classified as triage category 2 (real defects, not third-party noise).
- Document accepted third-party noise (category 3) in `apps/admin/CLAUDE.md` Common Gotchas section.
- Final pass: zero unexplained errors / warnings.

#### Stage Implementation — Phase 9: Final verification & spec closeout

- Re-run the audit checklist (every page in §4 of `docs/admin-pages-audit-report.md`) as
  SUPER_ADMIN, with console + network panels open. Update the audit doc with new state. Close
  this spec once 0 🔴 + 0 🟠 remain across A/B/C/D/V/CE.
- Update `docs/admin-pages-audit-report.md` to "verified" status with date.
- Update spec status to `completed` in `metadata.json` + `index.json`.

#### Phase ordering summary (visual)

```
Stage 0 (done) ──► Stage Discovery ──► Spec Update Checkpoint ──► Implementation
                   ├─ D.1 unblocked         (T-037, T-043, T-046)   Phase 1 (A LIST)
                   ├─ D.2 visual baseline                            Phase 2 (C crashes)
                   └─ D.3 console sweep                              Phase 3 (A-6 + M-2)
                                                                    Phase 4 (i18n)
                                                                    Phase 5 (billing/N/M/A2)
                                                                    Phase 6 (D blocked + D fixes)
                                                                    Phase 7 (V fixes)
                                                                    Phase 8 (CE fixes)
                                                                    Phase 9 (closeout)
```

(Implementation Phases 1-5 may run in parallel with the Discovery phase since they don't share
any code paths. Phases 6-9 strictly depend on Discovery + earlier Implementation phases.)

### 7. Test / Verification Strategy

- **Per-fix test**: each finding above has an Acceptance criterion. Test it manually in the
  browser AND, where applicable, add a test to the relevant package:
    - A-* fixes: contract test in `apps/api/test/routes/admin/<entity>/list.test.ts` (or `getById.test.ts` for A-6) that:
        - Seeds a row.
        - Hits the route with a SUPER_ADMIN actor.
        - Parses the response with the **same schema** the route declares.
        - Fails fast on schema mismatch.
    - C-* fixes: add a unit test on the affected hook or component that reproduces the
      `undefined.reduce/map` path.
    - I-* fixes: snapshot tests on the rendered title + headers in `es`, `en`, `pt`.
    - M-1: unit test on the gate function with `{ role: SUPER_ADMIN }` actor.
    - M-2: unit test on the retry policy with mocked errors.
- **Cross-cutting verification**: end of Phase 6, re-run the audit per `docs/admin-pages-audit-report.md`.
  Update the report's per-page table; commit the updated report alongside the closing PR.
- **CI**: typecheck + biome + vitest (already gated). Add the new contract tests to whichever
  test command CI runs for `apps/api`.

### 8. CRUD smoke methodology (per main entity)

Each main entity in §4 (D) gets one smoke run, executed in this exact order. The smoke is run
as `superadmin@hospeda.com` (SUPER_ADMIN) in the local admin against the local DB. Each step
produces a verifiable observation; failures become D-N.X findings with the per-step number.

**Standard 9-step smoke (single entity):**

1. **List baseline.** Navigate `/<entity>`. Capture row count from the table footer
   (`"Página 1 de N"`). Confirm console clean. Network panel: list endpoint returns 200.
2. **Create.** Click "Crear …" / "Nuevo …". Fill the minimum required fields (use a unique
   marker like `SMOKE-2026-05-14-<id>` in the name field for traceability). Submit.
   Observe success toast + redirect or modal close.
3. **Verify created — UI.** Return to list. Filter/search by the smoke marker. Confirm the new
   row appears. Click it; detail page loads with all the values entered in step 2.
4. **Verify created — DB.** `SELECT id, name, lifecycle_state, created_at FROM <table>
   WHERE name LIKE '%SMOKE-2026-05-14-%' ORDER BY created_at DESC LIMIT 1;`. Confirm the row
   exists, `lifecycle_state` is the expected default, `created_at` is recent.
5. **Edit.** Open the smoke row. Click "Edit" / "Editar". Change one field (e.g. append "-EDIT"
   to the name). Submit. Observe success toast.
6. **Verify edit — UI + DB.** List shows updated value. DB query confirms `updated_at > created_at`
   and the field changed.
7. **Soft delete.** Use the row's "Delete" / "Eliminar" / "Archivar" action. Confirm dialog
   if any. Observe success toast.
8. **Verify soft delete.** (a) Default list filter no longer shows the row. (b) "Mostrar
   eliminados" / `includeDeleted=true` filter shows it again with a deleted indicator. (c) DB:
   `deleted_at IS NOT NULL` AND `lifecycle_state = 'ARCHIVED'` (or the entity's equivalent).
9. **Restore.** From the deleted-rows view, click "Restore" / "Restaurar". Verify row returns
   to default list, DB row has `deleted_at = NULL` and lifecycle restored.

**For entities WITHOUT a soft-delete UI** (e.g. amenities, features, attractions, tags
sometimes): document in the smoke that step 7-9 are N/A; verify hard-delete works instead and
that the row leaves the DB.

**For entities with required relations** (e.g. accommodation needs a destination + owner; event
needs a location + organizer; sponsorship needs a sponsor + post): seed the dependencies first
or use an existing seeded row.

**For entities with multiple tabs** (e.g. accommodation has gallery / amenities / pricing /
reviews tabs): exercise the main entity smoke first; tab-level CRUD is a follow-up smoke when
the tab is independently functional.

**Smoke output format** (one file per entity in `docs/admin-crud-smoke/<entity>.md`):

```
# CRUD smoke — <entity>
Date: 2026-05-14
Operator: superadmin@hospeda.com
Marker: SMOKE-2026-05-14-<entity>

| Step | Result | Notes |
|------|--------|-------|
| 1 List baseline | ✅ / 🔴 | row count: N, errors: 0 |
| 2 Create | ✅ / 🔴 | id of created row |
| ... | ... | ... |

## Findings
- D-N.1: <symptom>
- D-N.2: <symptom>
```

### 9. Visual / Style audit methodology

**Tooling:** Chrome DevTools (already in use for the original audit). Screenshots via
`mcp__chrome-devtools__take_screenshot` (full page).

**Viewports tested per page:**

- Desktop: 1280×800 (default admin design target).
- Tablet: 768×1024 (iPad portrait).
- Mobile: 375×667 (iPhone SE — admin is desktop-first but should not horizontally scroll on phone).
- Dark mode: subset (dashboard + 2 list + 2 form pages) at 1280×800 to catch token leaks.

**Per-page recipe:**

1. Navigate, wait for content load (no `Cargando...` left).
2. `take_screenshot({fullPage: true})` → save to `docs/admin-pages-audit-screenshots/before/<viewport>/<route-slug>.png`.
3. Inspect for the §4 V baseline checklist items.
4. Note any defect with: viewport(s) where visible, suspected file/line if known, severity tier.
5. After fix lands, re-screenshot to `after/<viewport>/<route-slug>.png`.

**Page priority list (highest first):**

- Dashboard, all 17 LIST pages (main operator surface).
- All 17 CREATE pages (form sizing critical).
- 5 representative DETAIL pages (accommodation, destination, event, post, user).
- 3 settings pages (`/settings/critical`, `/settings/seo`, `/me/settings`).
- Auth pages: `/auth/signin`, `/auth/change-password` (already validated — light spot check).

**Defect catalog growth:** found visual defects accumulate as V-1, V-2, V-3, ... rows in §4
(V section). Severity tier (V-CRIT/HIGH/MED/LOW) drives whether they are fixed under this spec
or deferred. Default fix scope: V-CRIT + V-HIGH. V-MED deferred to a follow-up "polish" spec
unless the fix is < 5 minutes; V-LOW always deferred.

**Definition of "consistent"** for this audit:

- Same component instance across the panel uses the same paddings, radii, shadows, type scale.
- All gaps inside grids/flexes use the Tailwind spacing scale (no arbitrary px).
- Buttons within the same context (e.g., row of action buttons in a form footer) share `size`
  and `variant` family; the primary action sits on the right.
- `<Card>` headers and bodies use the same internal padding across all cards on a single page.

---

## Part 3 — Atomic Tasks

Use this list to drive `/task-master:task-from-spec` (or hand-track in `.claude/tasks/SPEC-117-...`).
Each task is sized to ≤ a single PR. Dependencies use task IDs.

Tasks are grouped into **Discovery** (D-discovery), **Spec Update Checkpoints** (mandatory gates),
and **Implementation Phases 1-9**. Discovery + Implementation Phases 1-5 can run in parallel.
Implementation Phases 6-9 are gated by Discovery completion AND earlier Implementation phases.

### Discovery (parallel with Implementation Phases 1-5)

| ID | Task | Stream | Depends on | Est. h |
|---|---|---|---|---|
| T-024 | Discovery D.1 — CRUD smoke: destinations (D-2) — produces `docs/admin-crud-smoke/destinations.md` | D.1 | — | 1 |
| T-025 | Discovery D.1 — CRUD smoke: events (D-3) | D.1 | — | 1 |
| T-026 | Discovery D.1 — CRUD smoke: event-locations (D-4) | D.1 | — | 1 |
| T-027 | Discovery D.1 — CRUD smoke: event-organizers (D-5) | D.1 | — | 1 |
| T-028 | Discovery D.1 — CRUD smoke: sponsors (D-8) | D.1 | — | 1 |
| T-029 | Discovery D.1 — CRUD smoke: accommodation-amenities (D-9) | D.1 | — | 0.75 |
| T-030 | Discovery D.1 — CRUD smoke: accommodation-features (D-10) | D.1 | — | 0.75 |
| T-031 | Discovery D.1 — CRUD smoke: destination-attractions (D-11) | D.1 | — | 0.75 |
| T-036 | Discovery D.1 — CRUD smoke: sponsorships (D-15), owner-promotions (D-16), newsletter-campaigns (D-17) | D.1 | T-019 (preferred but not strict) | 1.5 |
| T-041 | Discovery D.2 — Visual baseline: capture screenshots @ 1280/768/375 + dark-mode subset for all priority pages per §9; produce raw V-* candidate list | D.2 | — | 4 |
| T-042 | Discovery D.3 — Console sweep: walk every admin route w/ DevTools open, log every error/warn into a working table; cross-reference against A/B/C; produce raw CE-* candidate list | D.3 | — | 2 |

### Spec Update Checkpoints (mandatory gates between Discovery and D/V/CE Implementation)

| ID | Task | Output | Depends on | Est. h |
|---|---|---|---|---|
| T-037 | **Spec update for D**: open §4 of this spec, add concrete D-N.X finding rows from all D.1 smoke reports, re-evaluate effort estimate, decide in-scope vs. follow-up per the §5 risk rule. Commit. | spec.md MOD | T-024..T-031, T-036 | 1 |
| T-043 | **Spec update for V**: triage raw V-* candidates from T-041 into V-CRIT / V-HIGH / V-MED / V-LOW; populate §4 V section with concrete rows; commit to in-scope = V-CRIT + V-HIGH only per §5 cap. Commit. | spec.md MOD | T-041 | 1 |
| T-046 | **Spec update for CE**: triage raw CE-* candidates from T-042 (4 categories per §4 CE rules); populate §4 CE section with concrete rows; document category-3 noise plan. Commit. | spec.md MOD | T-042 | 1 |

### Implementation Phase 1 — Unblock admin LIST views

| ID | Task | Phase | Depends on | Est. h |
|---|---|---|---|---|
| T-001 | Diagnose A-1: hit `/api/v1/admin/users?page=1&pageSize=1` with admin token, capture exact Zod issue from API logs, document root cause | 1 | — | 1 |
| T-002 | Fix A-1 (UserAdminSchema vs service mapper alignment) + contract test | 1 | T-001 | 2 |
| T-003 | Fix A-2 (PostAdminSchema) + contract test, applying pattern from T-002 | 1 | T-002 | 2 |
| T-004 | Fix A-3 (InternalTagAdminSchema) + contract test | 1 | T-002 | 1.5 |
| T-005 | Fix A-4 (PostTagAdminSchema) + contract test | 1 | T-002 | 1.5 |
| T-006 | Fix A-5 (SystemTagAdminSchema) + contract test | 1 | T-002 | 1.5 |

### Implementation Phase 2 — Stop client crashes

| ID | Task | Phase | Depends on | Est. h |
|---|---|---|---|---|
| T-007 | Diagnose + fix C-1 (`billing/addons` undefined.reduce) | 2 | — | 1.5 |
| T-008 | Verify C-2 closes via T-007 OR fix independently | 2 | T-007 | 1 |
| T-009 | Fix C-3 (`revalidation` configs.map) | 2 | — | 1 |

### Implementation Phase 3 — Detail-view 500 + retry storm

| ID | Task | Phase | Depends on | Est. h |
|---|---|---|---|---|
| T-010 | Fix A-6 (AccommodationAdminDetailSchema) + contract test; verify 5 sibling tabs unblock | 3 | T-002 | 2 |
| T-011 | Fix M-2 (React Query retry policy: skip retries on 5xx + 429) + unit test | 3 | — | 1 |

### Implementation Phase 4 — i18n cleanup

| ID | Task | Phase | Depends on | Est. h |
|---|---|---|---|---|
| T-012 | Fix I-1 (EntityCreateContent placeholder) + snapshot test | 4 | — | 1 |
| T-013 | Fix I-2 (EntityPageBase / EntityViewContent English headers) + snapshot test | 4 | — | 1 |
| T-014 | Fix I-5 (sweep `<entity>.columns.ts` for English headers) | 4 | — | 1.5 |
| T-015 | Fix I-3 (roles catalog → i18n) | 4 | — | 2 |
| T-016 | Fix I-4 (permissions categories → i18n) | 4 | — | 1.5 |

### Implementation Phase 5 — Billing connectivity & dev ergonomics

| ID | Task | Phase | Depends on | Est. h |
|---|---|---|---|---|
| T-017 | Diagnose B-1..B-5 root cause (billing 503 in dev) | 5 | — | 2 |
| T-018 | Fix B-1..B-5 per T-017 outcome (config + retry policy via T-011) | 5 | T-017, T-011 | 2 |
| T-019 | Fix N-1 (newsletter campaigns sort param) | 5 | — | 0.5 |
| T-020 | Fix N-2 (newsletter subscribers 503) — same procedure as T-017/T-018 | 5 | T-017 | 1 |
| T-021 | Fix M-1 (plan-limit gate bypass for admin roles) + unit test | 5 | — | 1 |
| T-022 | Resolve A2: either pre-step `turbo build` in `dev-admin.js` OR extend `vite.config.ts` aliases for unaliased workspace packages | 5 | — | 1 |

### Implementation Phase 6 — CRUD smoke continuation + D-N.X fixes

| ID | Task | Phase | Depends on | Est. h |
|---|---|---|---|---|
| T-032 | CRUD smoke: users (D-7) — produces `docs/admin-crud-smoke/users.md` (now unblocked) | 6 | T-002 | 1 |
| T-033 | CRUD smoke: posts (D-6) | 6 | T-003 | 1 |
| T-034 | CRUD smoke: tags-internal (D-12), tags-post-tags (D-13), tags-system (D-14) | 6 | T-004, T-005, T-006 | 1.5 |
| T-035 | CRUD smoke: accommodations (D-1) — needs M-1 + A-6 | 6 | T-021, T-010 | 1 |
| T-037b | **Spec update for D (round 2)**: append additional D-N.X rows from T-032..T-035 to §4 | 6 | T-032..T-035 | 0.5 |
| T-038 | Fix wave A of D-N.X findings (in-scope per T-037 + T-037b triage) | 6 | T-037, T-037b | 4 |
| T-039 | Fix wave B of D-N.X findings (in-scope) | 6 | T-038 | 3 |
| T-040 | Re-run smokes on touched entities to verify fixes; record green outcomes in the smoke MD files | 6 | T-038, T-039 | 1.5 |

### Implementation Phase 7 — Fix V-CRIT + V-HIGH

| ID | Task | Phase | Depends on | Est. h |
|---|---|---|---|---|
| T-044 | Fix V-CRIT findings (per spec §4 V section, populated by T-043) | 7 | T-043 | 4 |
| T-045 | Fix V-HIGH findings | 7 | T-043 | 4 |
| T-047 | Re-screenshot to `docs/admin-pages-audit-screenshots/after/`; visual-diff against `before/`; commit both libraries (or document Git LFS / .gitignore decision per §5) | 7 | T-044, T-045 | 1.5 |

### Implementation Phase 8 — Fix CE-* findings

| ID | Task | Phase | Depends on | Est. h |
|---|---|---|---|---|
| T-048 | Fix CE-* findings classified as triage category 2; document category-3 noise in `apps/admin/CLAUDE.md` (Common Gotchas) | 8 | T-046 | 2 |

### Implementation Phase 9 — Final verification & spec closeout

| ID | Task | Phase | Depends on | Est. h |
|---|---|---|---|---|
| T-023 | Verification pass A/B/C/I/M/N: re-run original audit per page list in `docs/admin-pages-audit-report.md`, update report, close 🔴/🟠 markers | 9 | T-002..T-022 | 2 |
| T-049 | Final closeout: spec status → completed in metadata.json + index.json, audit report status → verified | 9 | T-023, T-040, T-047, T-048 | 0.5 |

**Estimated total:** ~64h (range 48-72 in metadata, allowing 30% buffer for unknown D-N.X / V-* / CE-N findings discovered during Discovery and during the Phase-6 second smoke wave).

---

## Part 4 — Files Touched (running list, updated as tasks land)

```
# Phase 0 (already on branch)
apps/admin/src/lib/kysely-shim.mjs                        NEW
apps/admin/vite.config.ts                                 MOD
docs/admin-pages-audit-report.md                          NEW
.claude/specs/SPEC-117-admin-pages-stabilization/         NEW (spec.md + metadata.json)

# Expected by phase (filled in as work lands)
# Phase 1: packages/schemas/src/entities/{user,post,tag}/...AdminSchema.ts (MOD)
#          apps/api/test/routes/admin/{users,posts,tags}/...test.ts (NEW)
# Phase 2: apps/admin/src/routes/_authed/billing/{addons,subscriptions}.tsx (MOD)
#          apps/admin/src/routes/_authed/revalidation/index.tsx (MOD)
# Phase 3: packages/schemas/src/entities/accommodation/...AdminDetailSchema.ts (MOD)
#          apps/admin/src/lib/query-client.ts (MOD)
# Phase 4: apps/admin/src/components/entity-pages/EntityCreateContent.tsx (MOD)
#          apps/admin/src/components/entity-pages/EntityViewContent.tsx (MOD)
#          apps/admin/src/features/<entity>/config/<entity>.columns.ts (multiple MOD)
#          packages/i18n/src/locales/{es,en,pt}/* (MOD)
# Phase 5: apps/admin/src/features/newsletter/... (MOD)
#          apps/admin/src/features/accommodations/hooks/... (MOD)
#          scripts/dev-admin.js OR apps/admin/vite.config.ts (MOD)
# Phase 6: docs/admin-crud-smoke/<entity>.md  (NEW, 17 files, one per entity)
#          fixes for D-N.X findings — locations TBD per finding
# Phase 7: docs/admin-pages-audit-screenshots/before/{1280x800,768x1024,375x667,dark-mode}/*.png  (NEW)
#          docs/admin-pages-audit-screenshots/after/{...}/*.png  (NEW)
#          fixes for V-CRIT + V-HIGH findings — locations TBD per finding
# Phase 8: apps/admin/CLAUDE.md (MOD — Common Gotchas section, document accepted console noise)
#          fixes for CE-* findings — locations TBD per finding
# Phase 9: docs/admin-pages-audit-report.md (MOD → "verified" status)
#          .claude/specs/SPEC-117-admin-pages-stabilization/metadata.json (MOD → status: completed)
#          .claude/specs/index.json (MOD)
```

---

## Part 5 — Implementation progress (in-flight)

### Tasks completed in this branch

| Task | Status | Files modified |
|------|--------|----------------|
| **A1** kysely shim (Phase 0) | ✅ | `apps/admin/src/lib/kysely-shim.mjs` (NEW), `apps/admin/vite.config.ts` |
| **T-001** Diagnose A-1 | ✅ | `docs/admin-crud-smoke/_a1-diagnosis.md` (NEW) |
| **T-002** Fix A-1 | ✅ | `packages/schemas/src/entities/user/user.access.schema.ts` — `profile` + `settings`: `.optional()` → `.nullish()` |
| **T-003** Fix A-2 | ✅ | `packages/schemas/src/entities/post/post.access.schema.ts` (sponsor → PostSponsor + adminInfo `.nullish()`), `packages/schemas/src/entities/tag/post-tag.schema.ts` (deletedAt + deletedById `.nullish()`), `packages/service-core/src/services/post/post.service.ts` (`_executeAdminSearch` override applies `flattenPostTagsRelation`) |
| **T-004** Fix A-3 / A-4 / A-5 | ✅ (closed by T-003 fix family) | `packages/schemas/src/entities/tag/tag.schema.ts` (deletedAt + deletedById `.nullish()`) |
| **T-010** Fix A-6 (accommodations/{id}) | ✅ verified end-to-end 2026-05-14 (chrome devtools, browser-driven) | `packages/schemas/src/common/faq.schema.ts` (faq.category `.nullish()`), `packages/service-core/src/services/accommodation/accommodation.helpers.ts` (`flattenAccommodationJoinRelations` helper, NEW), `packages/service-core/src/services/accommodation/accommodation.service.ts` (call to flatten in `_afterGetByField`, **amenities + features REMOVED from `getDefaultGetByIdRelations`** as workaround for Drizzle nested-with bug) |
| **T-011** Fix A-7 / A-8 (admin batch endpoints 500) | ✅ — uncovered during T-010 verification. Root cause: `*BatchResponseSchema = z.array(*Schema.nullable())` expected the full entity, but handlers return a partial object when the client passes `fields[]`. Fix: introduce `*BatchItemSchema = *Schema.partial().required({ id: true })` and use it in `*BatchResponseSchema`. Applied to 8 admin batch schemas + the event admin batch route (which previously had an inline `z.array(EventAdminSchema.nullable())`). | `packages/schemas/src/entities/{accommodation,amenity,attraction,destination,event,feature,post,user}/*.batch.schema.ts`, `apps/api/src/routes/event/admin/batch.ts` |

### Discoveries during implementation

1. **General root pattern for A-1 / A-2 / A-3 / A-4 / A-5 / partial A-6:** schemas using `.optional()`
   on fields that map to nullable JSONB or nullable audit columns reject the `null` Drizzle returns.
   Fix is universally `.optional()` → `.nullish()`. We already swept user / post / tag /
   post-tag / faq schemas. There may be more entities with the same defect (accommodation,
   destination, event, sponsor, etc.) — to verify on the next round.

2. **Toast-debug instrumentation**: `apps/api/src/utils/response-helpers.ts` was patched
   temporarily to expose the first 3 Zod issues in the API error message (so the client could
   surface the real cause instead of "Response payload does not match declared schema"). It
   was the diagnostic vehicle that surfaced A-7/A-8 (the batch endpoint partial-response bug)
   during T-010 verification. **REVERTED 2026-05-14** after T-011 fix shipped. The
   `NODE_ENV === 'development'` gated variant is intentionally **NOT** implemented — if we
   want it back as a permanent dev-only diagnostic, it should be tracked as a separate
   improvement, not bundled into this spec.

3. **Drizzle relational query API does NOT resolve nested-with cleanly when the relation uses
   `relationName`** (verified on `accommodations.amenities` → `r_accommodation_amenity.amenity`).
   The `{ with: { amenity: true } }` syntax produces `TypeError: Cannot read properties of
   undefined (reading 'referencedTable')` inside `normalizeRelation`. The current workaround
   removed `amenities` and `features` from `AccommodationService.getDefaultGetByIdRelations()`
   — the detail page still works because it has dedicated tab routes (`/accommodations/{id}/amenities`,
   `/accommodations/{id}/features`) that load these relations via their own endpoints. **Long-term
   fix** requires either (a) reconfiguring Drizzle relations on the join tables, or (b) adding
   a manual second-query inside `AccommodationService.getById` to load amenity+feature lists
   and inject them into the response.

4. **A new finding C-4 emerged during T-041 visual baseline**: `/billing/plans` now crashes
   with the same `undefined.reduce()` signature as C-1/C-2. Rolled into the C-* cluster in §4.

5. **A-7 / A-8 surfaced during T-010 verification**: `POST /admin/destinations/batch` and
   `POST /admin/users/batch` returned 500 with `0.createdAt/updatedAt/createdById required`.
   This is **NOT** part of the A-1..A-6 `.optional() → .nullish()` family. Root cause is a
   contract mismatch between the handler (returns a filtered partial when `fields[]` is
   present) and the response schema (`z.array(EntitySchema.nullable())` expects the full
   entity). Audit of all 8 admin batch endpoints (accommodation, amenity, attraction,
   destination, event, feature, post, user) confirmed they share the same factory pattern
   and are all vulnerable. Closed as T-011 via `*BatchItemSchema = *Schema.partial().required({ id: true })`.

### Files modified, not yet committed (BOTH repos)

```
# Worktree (../hospeda-admin-pages-audit) — these are the "real" changes for the PR:
M  apps/admin/vite.config.ts                                                     (A1)
M  apps/api/src/routes/event/admin/batch.ts                                      (T-011)
M  packages/schemas/src/common/faq.schema.ts                                     (T-010)
M  packages/schemas/src/entities/accommodation/accommodation.batch.schema.ts    (T-011)
M  packages/schemas/src/entities/amenity/amenity.batch.schema.ts                (T-011)
M  packages/schemas/src/entities/attraction/attraction.batch.schema.ts          (T-011)
M  packages/schemas/src/entities/destination/destination.batch.schema.ts        (T-011)
M  packages/schemas/src/entities/event/event.batch.schema.ts                    (T-011)
M  packages/schemas/src/entities/feature/feature.batch.schema.ts                (T-011)
M  packages/schemas/src/entities/post/post.access.schema.ts                      (T-003)
M  packages/schemas/src/entities/post/post.batch.schema.ts                       (T-011)
M  packages/schemas/src/entities/tag/post-tag.schema.ts                          (T-003)
M  packages/schemas/src/entities/tag/tag.schema.ts                               (T-003)
M  packages/schemas/src/entities/user/user.access.schema.ts                      (T-002)
M  packages/schemas/src/entities/user/user.batch.schema.ts                       (T-011)
M  packages/service-core/src/services/accommodation/accommodation.helpers.ts    (T-010)
M  packages/service-core/src/services/accommodation/accommodation.service.ts    (T-010)
M  packages/service-core/src/services/post/post.service.ts                       (T-003)
?? apps/admin/src/lib/kysely-shim.mjs                                            (A1)
?? .claude/specs/SPEC-117-admin-pages-stabilization/                             (this spec)
?? docs/admin-crud-smoke/                                                        (T-024..T-031, T-026, T-027, T-028, _a1-diagnosis)
?? docs/admin-pages-audit-report.md                                              (original audit)
?? docs/admin-pages-audit-screenshots/                                           (T-041 baseline)

# Main repo (/home/qazuor/projects/WEBS/hospeda) — applied here too because the dev API
# runs from this repo. Now identical to worktree (TEMP debug was reverted 2026-05-14):
M  packages/schemas/src/common/faq.schema.ts                                     (mirror)
M  packages/schemas/src/entities/accommodation/accommodation.batch.schema.ts    (mirror)
M  packages/schemas/src/entities/amenity/amenity.batch.schema.ts                (mirror)
M  packages/schemas/src/entities/attraction/attraction.batch.schema.ts          (mirror)
M  packages/schemas/src/entities/destination/destination.batch.schema.ts        (mirror)
M  packages/schemas/src/entities/event/event.batch.schema.ts                    (mirror)
M  packages/schemas/src/entities/feature/feature.batch.schema.ts                (mirror)
M  packages/schemas/src/entities/post/post.access.schema.ts                      (mirror)
M  packages/schemas/src/entities/post/post.batch.schema.ts                       (mirror)
M  packages/schemas/src/entities/tag/post-tag.schema.ts                          (mirror)
M  packages/schemas/src/entities/tag/tag.schema.ts                               (mirror)
M  packages/schemas/src/entities/user/user.access.schema.ts                      (mirror)
M  packages/schemas/src/entities/user/user.batch.schema.ts                       (mirror)
M  apps/api/src/routes/event/admin/batch.ts                                      (mirror)
M  packages/service-core/src/services/accommodation/accommodation.helpers.ts    (mirror)
M  packages/service-core/src/services/accommodation/accommodation.service.ts    (mirror)
M  packages/service-core/src/services/post/post.service.ts                       (mirror)
```

### Verification status

| Endpoint | Verified working? |
|---|---|
| `GET /api/v1/admin/users` (list) | ✅ verified — 41 users return 200 |
| `GET /api/v1/admin/users/{id}` | ✅ verified |
| Dashboard "Users" counter | ✅ verified — shows 41 |
| `GET /api/v1/admin/posts` (list) | ✅ verified — 18 posts return 200 |
| `/posts` admin page | ✅ verified — 15 rows |
| `GET /api/v1/admin/tags/internal` | ✅ verified |
| `GET /api/v1/admin/tags/system` | ✅ verified |
| `GET /api/v1/admin/posts/tags` | ✅ verified |
| `GET /api/v1/admin/accommodations/{id}` | ✅ verified 2026-05-14 — returns 200 |
| `POST /api/v1/admin/destinations/batch` | ✅ verified 2026-05-14 — returns 200 with partial body |
| `POST /api/v1/admin/users/batch` | ✅ verified 2026-05-14 — returns 200 with partial body |
| `/accommodations/{id}` admin detail page (browser smoke) | ✅ verified 2026-05-14 — renders accommodation header, sections, resolved destination + owner names from batch enrichment |

### T-010 closure status (2026-05-14)

- ✅ `GET /api/v1/admin/accommodations/{id}` returns 200.
- ✅ `/accommodations/{id}` admin detail page loads without the "Cargando…" stuck state.
- ✅ Tab `/accommodations/{id}/amenities` loads ("No amenities assigned" — content-valid).
- ⚠️ Tab `/accommodations/{id}/features` does **not** exist as a real client route (404). The
  spec originally listed this as a verification target, but the actual admin UI tabs are
  `General | Galería | Amenidades | Reseñas | Precios`. No features tab is rendered, so the
  workaround (removing features from `getDefaultGetByIdRelations`) has no user-visible
  regression on this entity.
- ✅ TEMP debug in `apps/api/src/utils/response-helpers.ts` reverted to original throw.
- ⏭️ The `.optional() → .nullish()` sweep on destination / event / sponsor / amenity /
  feature / attraction admin schemas is **NOT** done yet. Each schema will be exercised
  when the corresponding admin LIST + DETAIL endpoints are smoked in Phase 6 (D-* batch);
  reactive fixes there will be cheaper than a blind sweep now.

### What still needs to happen overall (from §6 phase plan)

- **Phase 2** — Fix the 3 client-side crashes (C-1 billing/addons, C-2 billing/subscriptions,
  C-3 revalidation, plus newly-discovered C-4 billing/plans). All 4 share the same shape
  (`undefined.reduce()` / `.map()`); single fix likely closes all.
- **Phase 3** — M-2 React Query retry policy.
- **Phase 4** — i18n cleanup (I-1 placeholder leak, I-2 detail headers, I-3 roles, I-4 perms,
  I-5 columns).
- **Phase 5** — Billing 503/429 (B-1..B-5), N-1 newsletter sort param, N-2 newsletter
  subscribers 503, M-1 plan-limit gate bypass for admin, A2 dev workflow.
- **Phase 6** — D-* fixes (CRUD smoke findings: D-2.1 dot-notation form bug, D-4.1 destinationId
  missing, D-CONTENT.1 delete UI absent, D-8.1 ghost-create on sponsors, D-TOAST.1/2, etc.).
- **Phase 7** — V-CRIT + V-HIGH visual fixes (V-1 dashboard inconsistent cards, V-2 mobile
  FAB obstruction, V-3 mobile filter labels, V-4 desktop FAB on textarea).
- **Phase 8** — CE cleanup (mostly already covered by A/B/C; vite warnings documented).
- **Phase 9** — Final verification + spec close.

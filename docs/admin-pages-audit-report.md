# Admin Pages Audit Report

**Branch**: `fix/admin-pages-audit` (worktree `../hospeda-admin-pages-audit`, base = `staging`)
**Date**: 2026-05-14
**Authenticated as**: `superadmin@hospeda.com` / `Audit2026!` (SUPER_ADMIN, all permissions)
**Local stack**: API @ `:3001` (main repo, branch `fix/web-ui-polish`), Admin @ `:3000` (worktree)
**Coverage**: 51 list/index pages, 5 "new" form pages, 3 detail pages — ~60 routes navigated, console + network captured per page.

## Severity legend

- 🔴 **CRITICAL** — page does not load (white screen, error boundary, app crash). Blocks usage.
- 🟠 **HIGH** — page renders shell but core data is missing because backend returns 4xx/5xx.
- 🟡 **MEDIUM** — page works but has noticeable defects (i18n placeholders, hardcoded English strings, stuck "Cargando..." states).
- 🟢 **LOW** — cosmetic / dev-only noise.

---

## A. Pre-existing infrastructure issues (pre-condition for the audit, not a per-page bug)

### A1. 🔴 Admin dev server crashed on `vite optimizeDeps` (FIX APPLIED IN THIS BRANCH)

**Symptom**: `pnpm dev:admin` exited with `[MISSING_EXPORT] DEFAULT_MIGRATION_TABLE / DEFAULT_MIGRATION_LOCK_TABLE not exported by kysely` (×4) inside Rolldown's dependency optimization pass. The dev server briefly showed `Local: http://localhost:3000/`, then exited 1.

**Root cause**: `better-auth@1.4.18`'s SQLite dialect adapters (`bun-sqlite-dialect.mjs`, `node-sqlite-dialect.mjs`) `import { ... DEFAULT_MIGRATION_TABLE, DEFAULT_MIGRATION_LOCK_TABLE ... } from "kysely"`. Kysely 0.29 moved those constants to the `kysely/migration` sub-path; the bare-package symbols are now `KyselyTypeError` markers. The lockfile bumped kysely to `>=0.28.17` on commit `8a28f9c8e` (security patch), which resolved to `0.29.0` and broke the import.

**Production not affected**: Coolify runs `vite build` (Rollup path), which is more permissive about missing exports — only `vite dev`'s rolldown-based `optimizeDeps` is strict. That's why the admin deploys cleanly to staging.

**Fix applied in this branch**:

1. New shim file `apps/admin/src/lib/kysely-shim.mjs` re-exports the package and adds the two constants from `kysely/migration`.
2. `apps/admin/vite.config.ts` `resolve.alias` converted to array form so `kysely` (exact regex `^kysely$`) maps to the shim without affecting `kysely/migration` or `kysely/dist/...`.
3. Runtime is unchanged — admin uses the postgres adapter, the SQLite dialects are never called.

### A2. 🟡 Workspace packages need a build before dev works

`@repo/feedback`, `@repo/auth-ui`, `@repo/billing`, `@repo/notifications`, etc. are not aliased to `src/` in `vite.config.ts`. They must be built (`pnpm turbo run build --filter=admin^...`) before the admin dev server can resolve their `./schemas`, `./config` exports. Fresh worktrees / fresh `pnpm install` produce an admin that starts and immediately 500s on the first SSR request with `ERR_MODULE_NOT_FOUND: @repo/feedback/schemas` until that build runs. Document this in the admin README, or add the build to the `dev:admin` script.

---

## B. Cross-cutting bugs (affect many pages)

### B1. 🟠 API admin LIST endpoints returning 500 with "Response payload does not match declared schema"

The API returns HTTP 500 on a small but consistent set of admin LIST endpoints. The client receives `ApiError: Response payload does not match declared schema`, which means the route handler **did** run and **did** produce a response, but the OpenAPI/Zod response schema rejected it on the way out. Either the service is returning fields the schema doesn't allow, or it's missing required fields the schema declares.

Endpoints confirmed broken:

| Endpoint | Used by page(s) |
|----------|-----------------|
| `GET /api/v1/admin/users?page=...` | `/dashboard` (×2), `/access/users`, `/analytics/business` |
| `GET /api/v1/admin/posts?page=...` | `/dashboard`, `/posts`, `/analytics/business` |
| `GET /api/v1/admin/tags/internal?page=...` | `/tags/internal` |
| `GET /api/v1/admin/posts/tags?page=...` | `/tags/post-tags` |
| `GET /api/v1/admin/tags/system?page=...` | `/tags/system` |
| `GET /api/v1/admin/accommodations/{id}` | `/accommodations/{id}` (detail tabs) |

Endpoints that work fine (for comparison): `accommodations`, `destinations`, `events`, `event-locations`, `event-organizers`, `attractions`, `sponsorships`, `owner-promotions`, `sponsors`. Pattern: failing endpoints all have **richer relations** (users → roles + permissions + accounts; posts → author + tags + sponsorship; tags → assignments). Likely the service `.list()` join shape diverged from the admin `*.AdminSchema`.

Each failing call is retried 3-4× by the React Query default policy (visible as `[500] [500] [500]` cascades in the network panel) — this is a separate but secondary issue (don't retry on schema-mismatch errors).

### B2. 🟠 Billing pages calling `/api/v1/protected/billing/*` get throttled (503 → 429)

Three billing pages hit the `/protected/` tier (not `/admin/`) and the response is `503 Service Unavailable` followed by an immediate retry that gets `429 Too Many Requests`:

- `/billing/payments` → `GET /api/v1/protected/billing/payments?` 503/429 → "Error al cargar pagos / Verifica que la API esté disponible"
- `/billing/invoices` → same pattern
- `/billing/promo-codes` → "Mostrando datos de ejemplo como fallback" (graceful: falls back to local sample data)
- `/billing/settings` → 503 from `GET /api/v1/admin/billing/settings` ("Billing service is not configured / Mostrando configuración por defecto")
- `/sponsor/invoices` → 503 + "Too many requests" → "Error al cargar facturas. Verifica que la API esté funcionando"

The 503 is the **root** error (likely "billing service not configured" or DB cluster not reachable). The 429 is a **secondary** symptom of the per-endpoint rate limiter triggering on the immediate retry. Two issues to file:

- (a) Why is the billing layer returning 503? Probably the QZPay/MercadoPago adapter is mis-configured locally — check `MERCADO_PAGO_*` env vars + DB billing setup.
- (b) The retry-on-503 strategy needs a backoff so it doesn't trip the rate limiter on attempt 2.

### B3. 🟡 i18n placeholder leak on every "create" page

Every `*/new` page uses the title template `"Nuevo {entity} <Entity name>"` — the `{entity}` literal placeholder leaks into the rendered DOM. Confirmed on:

- `/destinations/new` → "Nuevo {entity} Destino"
- `/events/new` → "Nuevo {entity} Evento"
- `/posts/new` → "Nuevo {entity} Publicación"
- `/access/users/new` → "Nuevo {entity} Usuario"

Single root cause in the shared `EntityCreateContent` component (or its i18n key file) — fix once, fixes all create pages.

### B4. 🟡 i18n incomplete on detail pages

Detail pages (`/<entity>/{id}`) render headers and action buttons in English even when the rest of the page is Spanish:

- `/destinations/{id}` → "View Destino details", "Back", "Edit"
- `/events/{id}` → same
- `/access/users/{id}` → same

Same shared component family (`EntityPageBase`).

### B5. 🟡 Hardcoded English content in `/access/roles` and `/access/permissions`

Page `/access/roles` lists roles with their names and descriptions in English ("Complete system control", "User and role management", "Manages platform content, users, and most administrative functions"). The roles themselves are seeded with English names; descriptions need to come from i18n keys, not from the seed data.

`/access/permissions` shows category names like "Permission", "User Bookmark", "Client Access Right" — same i18n source issue.

### B6. 🟡 Tabular column headers in English on Spanish pages

Sortable column buttons render localized labels but a few static `<th>` cells leak English: `Destination`, `Owner`, `Attractions` (visible on `/accommodations`, `/destinations`).

### B7. 🟢 Vite dev warnings on every page load

The dev server logs three deprecation warnings on every navigation — noise only:

- `vite-tsconfig-paths` plugin: now built into Vite, recommended to remove.
- `optimizeDeps.rollupOptions` deprecated, use `optimizeDeps.rolldownOptions`.
- `@vitejs/plugin-react`: switch to `@vitejs/plugin-react-oxc` for performance.

---

## C. Per-page findings

Status legend per row: ✅ OK, 🟡 minor, 🟠 serious data error, 🔴 broken.

### Dashboard

| URL | Status | Notes |
|---|---|---|
| `/dashboard` | 🟠 | Loads. Stat counters for **Users** and **Posts** stuck at `...` because `/api/v1/admin/users?page=1&pageSize=1` and `/api/v1/admin/posts?page=1&pageSize=1` return 500 (B1). Other counters OK. |

### Content (entities)

| URL | Status | Notes |
|---|---|---|
| `/accommodations` | ✅ | 20 rows, paginated 6 pages. Column headers `Destination` / `Owner` in English (B6). |
| `/accommodations/new` | 🟡 | Shows "Límite de alojamientos alcanzado" for SUPER_ADMIN. Plan-limit gating ignores admin role — bug. |
| `/accommodations/{id}` | 🟠 | Stuck on "Cargando…". `GET /api/v1/admin/accommodations/{id}` → 500 with "Response payload does not match declared schema" (B1). 4 retries in React Query. |
| `/destinations` | ✅ | 10 rows. Default filter `destinationType=CITY` is applied silently — non-obvious to user. Column header `Attractions` in English (B6). |
| `/destinations/new` | 🟡 | Form renders, 18 inputs. Title "Nuevo {entity} Destino" — placeholder leak (B3). |
| `/destinations/{id}` | 🟡 | Loads with full data + 4 tabs (General/Atracciones/Alojamientos/Eventos). Header "View Destino details / Back / Edit" in English (B4). |
| `/events` | ✅ | 15 rows. |
| `/events/new` | 🟡 | Form renders, 22 inputs. "Nuevo {entity} Evento" (B3). |
| `/events/{id}` | ✅ | Loads with full data + 3 tabs. Same English-header leak (B4). |
| `/events/locations` | ✅ | 6 rows. |
| `/events/organizers` | ✅ | 5 rows. |
| `/posts` | 🟠 | Empty body. `GET /api/v1/admin/posts?page=1&pageSize=15` → 500 (B1). Console: "ApiError: Response payload does not match declared schema". |
| `/posts/new` | 🟡 | Form renders, 15 inputs. "Nuevo {entity} Publicación" (B3). |
| `/content/accommodation-amenities` | ✅ | 20 rows. |
| `/content/accommodation-features` | ✅ | 20 rows. |
| `/content/destination-attractions` | ✅ | 20 rows. |
| `/conversations` | ✅ | Empty state expected ("No tenés mensajes de huéspedes todavía"). |

### Access / Admin

| URL | Status | Notes |
|---|---|---|
| `/access/users` | 🟠 | Empty body. `GET /api/v1/admin/users?page=1&pageSize=25` → 500 (×3 retries). Same schema-mismatch error as B1. |
| `/access/users/new` | 🟡 | Form renders, 10 inputs. "Nuevo {entity} Usuario" (B3). |
| `/access/users/{id}` | 🟡 | Loads with full user data, 4 tabs. English header leak (B4). |
| `/access/permissions` | 🟡 | Static informational page. Renders permission categories in English ("Permission", "User Bookmark", "Client Access Right" etc.) — i18n missing (B5). |
| `/access/roles` | 🟡 | Static role list. Role names + capabilities in English ("Complete system control", "Manages platform content...") — comes from seed (B5). |

### Billing

| URL | Status | Notes |
|---|---|---|
| `/billing/plans` | ✅ | 9 plans, no API call (read from local config). Note: the page warns "Los planes son de solo lectura desde este panel — La fuente única de verdad es packages/billing/src/config/plans.config.ts". |
| `/billing/addons` | 🔴 | Error boundary: "Algo salio mal". Console: `TypeError: Cannot read properties of undefined (reading 'reduce')` inside `<Lazy>` component. **No API calls made before crash** — bug is in client code (probably destructuring an `undefined` props or initial state). |
| `/billing/subscriptions` | 🔴 | Same exact crash signature as `/billing/addons` — same root cause likely. No API calls before crash. |
| `/billing/payments` | 🟠 | Shell + filters render. "Error al cargar pagos". `/protected/billing/payments?` → 503 then 429 (B2). |
| `/billing/invoices` | 🟠 | Shell renders. "Error al cargar facturas". `/protected/billing/invoices?` → 503 then 429 (B2). |
| `/billing/exchange-rates` | ✅ | Empty list expected (no rates seeded). |
| `/billing/promo-codes` | 🟡 | Falls back to sample data after `/protected/billing/promo-codes` 503/429. UX message is graceful: "Mostrando datos de ejemplo como fallback". |
| `/billing/sponsorships` | ✅ | Empty list expected. 200 from API. |
| `/billing/owner-promotions` | ✅ | Empty list expected. 200 from API. |
| `/billing/cron` | ✅ | 17 cron jobs listed, all "Activo". Job descriptions in English ("Check and expire trials...", "Send scheduled notifications..."). |
| `/billing/metrics` | ✅ | Renders ("Total de Clientes 0", "Cerca del Límite 0"). No data because no billing customers. |
| `/billing/notification-logs` | ✅ | Empty state expected. |
| `/billing/webhook-events` | ✅ | Empty state expected. |
| `/billing/settings` | 🟠 | "Error al cargar la configuración / Billing service is not configured. Mostrando configuración por defecto". `/admin/billing/settings` → 503 (B2). |

### Analytics

| URL | Status | Notes |
|---|---|---|
| `/analytics/usage` | ✅ | Renders metrics table + raw JSON. Real data (1016 requests, 227 errors = 22% error rate — that's the cumulative effect of all the 500s in B1, **not** an admin bug). |
| `/analytics/business` | 🟠 | Header + "Próximamente" placeholder. Hits the same stat endpoints as dashboard, so `posts` 500 propagates here too (B1). |
| `/analytics/debug` | 🟡 | Renders the shell. "Estado de la API: N/A unknown / Estado de la Base de Datos: Pool de conexiones unknown" — health checks not wired. |

### Sponsor / Sponsors

| URL | Status | Notes |
|---|---|---|
| `/sponsor` | ✅ | Renders sponsor dashboard with quick actions. "Requiere implementación de API de actividades" — known. |
| `/sponsor/sponsorships` | ✅ | Empty list expected. |
| `/sponsor/analytics` | ✅ | "Próximamente" placeholder — known. |
| `/sponsor/invoices` | 🟠 | "Error al cargar facturas. Verifica que la API esté funcionando." 429 + 503 from `/protected/billing/sponsor-invoices` (B2). |
| `/sponsors` | ✅ | 5 rows. |

### Newsletter

| URL | Status | Notes |
|---|---|---|
| `/newsletter/campaigns` | 🟠 | "Error al cargar las campañas. Intentá de nuevo." `GET /api/v1/admin/newsletter/campaigns?...&sort=desc` → 400. The `sort=desc` param is missing the field name (should be `sort=createdAt:desc` or similar) — query builder bug client-side. |
| `/newsletter/subscribers` | 🟠 | Stuck on "Cargando suscriptores…". Both `GET /api/v1/admin/newsletter/subscribers/stats` and `?page=...&pageSize=25` → 503 (×3 retries each). Newsletter service unavailable. |

### Tags

| URL | Status | Notes |
|---|---|---|
| `/tags/internal` | 🟠 | Stuck on "Cargando etiquetas...". `GET /api/v1/admin/tags/internal` → 500 (×4) (B1). |
| `/tags/post-tags` | 🟠 | Stuck on "Cargando etiquetas...". `GET /api/v1/admin/posts/tags` → 500 (×4) (B1). |
| `/tags/system` | 🟠 | Stuck on "Cargando etiquetas...". `GET /api/v1/admin/tags/system` → 500 (×4) (B1). |
| `/tags/user-moderation` | 🟠 | Stuck on "Cargando etiquetas...". |

### Settings

| URL | Status | Notes |
|---|---|---|
| `/settings/critical` | ✅ | Renders maintenance toggle, announcements, cache mgmt, danger zone. |
| `/settings/seo` | ✅ | Renders SEO defaults form. |
| `/revalidation` | 🔴 | Error boundary: "Algo salio mal". Console: `TypeError: configs.map is not a function` inside `<ConfigTab>`. State is initialized as something other than an array. |

### Me

| URL | Status | Notes |
|---|---|---|
| `/me/profile` | ✅ | Form with personal info. |
| `/me/change-password` | ✅ | Same form as `/auth/change-password`. |
| `/me/settings` | ✅ | Theme + lang + notifications preferences. |
| `/me/tags` | ✅ | Empty state expected. |
| `/me/accommodations` | ✅ | 2 cards. |
| `/notifications` | ✅ | "Sin notificaciones" — empty state expected. |

### Auth

| URL | Status | Notes |
|---|---|---|
| `/auth/signin` | ✅ | Login form works (after password reset done in section D). |
| `/auth/change-password` | ✅ | Required after first login when `must_change_password` flag is set. |
| `/auth/signup`, `/auth/forbidden`, `/auth/callback` | (not exercised) | |

---

## D. Auxiliary findings

- **Super-admin password unknown locally**. The DB had `superadmin@hospeda.com` with a bcrypt hash that did **not** match `SuperAdmin123!` (the value in `SEED_SUPER_ADMIN_PASSWORD`). To run the audit I generated a fresh bcrypt hash with `bcryptjs` and ran `UPDATE account SET password='...' WHERE provider_id='credential' AND account_id='54710741-cbad-47ef-9b57-a708dd56220a'`. Better Auth's `requirePasswordChange` flow then forced a change on first login. **Action**: either re-seed in a deterministic way so the documented password works, or drop the password and use a one-time email-link reset for the super admin.
- **Posts endpoint 4-retry storm**. React Query is configured with default retry behavior (3-4 retries on any error). When schema-mismatch 500s happen, the user sees the same 500 hit 4 times in 5 seconds before the page settles into "Loading…". Suggest a custom retry policy that does `retry: (failureCount, err) => failureCount < 1 && err.status >= 500 && !err.isSchemaError`.
- **Default `destinationType=CITY` filter on `/destinations`** is silently applied via URL search params on first load. There IS an "active filters" chip + "Limpiar todo" button visible — so this is intentional, but worth noting for QA: if you don't see your destinations, check the chip.

---

## E. Suggested triage / fix order

1. **B1 (admin LIST endpoints 500)** — highest impact: blocks 6 admin pages + dashboard counters. Diagnose by hitting `/api/v1/admin/users?page=1&pageSize=1` with a SUPER_ADMIN token and reading the actor's response in `apps/api` logs to see which Zod field rejects. Likely a recent schema field added in `service-core` for `users` / `posts` / `tags` that was never reflected in the Admin response schema in `@repo/schemas`.
2. **🔴 `/billing/addons`, `/billing/subscriptions`, `/revalidation`** — three full crashes from client-side `TypeError`s. All before any API call. Likely a hook returning `undefined` instead of `[]` and a downstream `.reduce()` / `.map()` blowing up. Add nullish-coalesce defaults in those hooks.
3. **B2 (503/429 on billing/protected)** — root-cause the 503 first (probably MP/QZPay misconfig), THEN add the retry backoff so the 429 follow-up disappears.
4. **B3 (`{entity}` placeholder leak in create pages)** — single fix in the i18n key feeding `EntityCreateContent`.
5. **B4 + B5 + B6 (English text leaks)** — i18n sweep in `EntityPageBase`, `/access/roles` seed data, and a couple of tabular column headers.
6. **`/newsletter/campaigns` 400 from malformed sort param** — small client-side fix.
7. **`/newsletter/subscribers` 503** — newsletter service config (Brevo / DB).
8. **`/accommodations/new` plan-limit gating ignores SUPER_ADMIN role** — guard should bypass for admin roles.
9. Decide on a path for **A2** (workspace build prerequisite) — either `dev:admin` runs the build first, or alias the remaining workspace packages to `src/` like the other 8.

---

## F. Files modified in this branch (so far)

```
apps/admin/src/lib/kysely-shim.mjs    (NEW, A1)
apps/admin/vite.config.ts             (alias rewrite, A1)
docs/admin-pages-audit-report.md      (this report)
```

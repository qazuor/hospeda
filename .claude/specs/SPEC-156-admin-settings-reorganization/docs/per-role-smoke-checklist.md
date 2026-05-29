# SPEC-156 PR-4 — Per-role manual smoke checklist (T-042)

This checklist is the **gating manual run** before merging PR-4 to `staging` and again before promoting `staging` to `main`. It tours every route SPEC-156 touched (PR-1 through PR-4) against three roles:

- **HOST** — paying host with `BILLING_VIEW_OWN` + `SUBSCRIPTION_VIEW_OWN`
- **ADMIN** — non-super admin (everything except `MAINTENANCE_MODE_WRITE`)
- **SUPER_ADMIN** — full access including critical platform state + announcements editor

The dev seeder under `packages/seed/CLAUDE.md#test-users-for-billing-spec-143-block-1` creates one user per role × plan combination. Recommended logins:

| Role | Login | Notes |
|---|---|---|
| HOST | `host-paid@local.test` / `Password123!` | Active paid plan with usage. |
| ADMIN | `admin@local.test` / `Password123!` | Standard admin, no super-only perms. |
| SUPER_ADMIN | `super-admin@local.test` / `Password123!` | Full access. |

Run each row against a freshly-restarted dev session (`pnpm db:fresh-dev && pnpm dev`) on `http://localhost:3000` (admin) + `http://localhost:4321` (web).

---

## A. Account namespace (`/account/*`)

| Route | HOST | ADMIN | SUPER_ADMIN | What to verify |
|---|---|---|---|---|
| `/account/profile` | ✅ visible + editable | ✅ visible + editable | ✅ visible + editable | Saving display name / bio persists across reload. |
| `/account/preferences` | ✅ visible + editable | ✅ visible + editable | ✅ visible + editable | Theme + language toggles take effect on the next page render. |
| `/account/notifications` | ✅ visible + editable | ✅ visible + editable | ✅ visible + editable | Master toggle + email channel persist. SMS + push show `(no disponible)` and are visually disabled. |
| `/account/security` | ✅ visible | ✅ visible | ✅ visible | Lists `Cambiar contraseña` link + 4 `(próximamente)` stubs (2FA, sessions, login history, change email). |
| `/account/security/change-password` | ✅ visible + works | ✅ visible + works | ✅ visible + works | 3-step flow (current → new → confirm) succeeds; password strength meter updates. |
| `/account/data` | ✅ placeholder | ✅ placeholder | ✅ placeholder | "Próximamente" copy + working mailto link to support inbox. |
| `/account/tags` | ✅ visible + editable | ✅ visible + editable | ✅ visible + editable | Own user-tag CRUD works at the new path. |
| `/account/billing` | ✅ visible | ❌ visible (perms granted via role bundles) | ✅ visible | Sidebar entry shown; SubscriptionSummary + PlanUsage + BillingActions render. |
| `/account/billing` (EDITOR) | n/a | ❌ 403 → `/auth/forbidden` | n/a | EDITOR test user MUST be denied (BILLING_VIEW_OWN not in bundle). |

> **Note**: ADMIN gets `BILLING_VIEW_OWN` + `SUBSCRIPTION_VIEW_OWN` via the role bundle (seeded in PR-1 T-007), so the page is reachable. Mi facturación is HOST-targeted UX but the gate is permission-based, not role-based — verify the sidebar entry appears for ADMIN with `--filter=admin@local.test` and shows the empty/error states gracefully when their account has no billing rows.

---

## B. Mi facturación page (`/account/billing`) details

| Section | Verify |
|---|---|
| Section 1 — Mi plan | Plan name + status badge + `currentPeriodEnd` localized date. Switch locale and confirm the date format follows. |
| Section 2 — Uso de mi plan | Accommodations bar renders with correct used/limit ratio. Set the seeded user's plan to one with a `null` limit and confirm the "Sin límite" label appears. |
| Section 2 — thresholds | Manually set the user's usage to ≥ 80% (warning) and ≥ 95% (danger) and confirm the bar tone changes. |
| Section 3 — Manage subscription | Link opens in a new tab pointing to `${VITE_SITE_URL}/{locale}/mi-cuenta/suscripcion`. |
| Section 3 — Descargar última factura | Renders only when the latest invoice has a `pdfUrl`; otherwise the "Todavía no tenés facturas disponibles" note appears. |

---

## C. Platform namespace (`/platform/*`)

| Route | HOST | ADMIN | SUPER_ADMIN | What to verify |
|---|---|---|---|---|
| `/platform/critical` | 🚫 hidden | 🚫 hidden (no SYSTEM_MAINTENANCE_MODE) | ✅ visible + editable | Maintenance toggle PATCHes the API (network tab shows `PATCH /api/v1/admin/platform-settings/maintenance.mode`). The announcements card now shows the editor link + preview. |
| `/platform/critical/announcements` | 🚫 hidden | 🚫 hidden | ✅ visible | Lists current announcements; "Nuevo anuncio" CTA + per-row Edit + Delete actions render. |
| `/platform/critical/announcements/new` | 🚫 hidden | 🚫 hidden | ✅ visible + works | Form requires all 3 locales; selecting `endsAt` before `startsAt` shows the inline error. On save the new item appears in the list AND on the web (after 5 min cache or hard reload). |
| `/platform/critical/announcements/$id/edit` | 🚫 hidden | 🚫 hidden | ✅ visible + works | Seeded values match; saving updates the row in place (preserves id). Deleting from the list view removes it from the API. |
| `/platform/configuration/seo` | 🚫 hidden | ✅ visible + editable | ✅ visible + editable | Form PATCHes `seo.defaults`. After save, look at the API logs for `SEO defaults: ...` or a `revalidateByEntityType('post')` log line confirming the hook fired. |
| `/platform/cache/revalidation` | 🚫 hidden | ✅ visible | ✅ visible | 3 tabs (Config / Logs / Manual) switch. |
| `/platform/ops/cron` | 🚫 hidden | ✅ visible | ✅ visible | Cron list renders at new path. |
| `/platform/ops/webhooks` | 🚫 hidden | ✅ visible | ✅ visible | Delivery log, per-event detail, retry button all work. |
| `/platform/email/logs` | 🚫 hidden | ✅ visible | ✅ visible | Email history with filters works. |
| `/platform/tags/internal` | 🚫 hidden | ✅ visible + editable | ✅ visible + editable | Tag CRUD works. List → New → back works; List → Edit → back works. |
| `/platform/tags/system` | 🚫 hidden | ✅ visible + editable | ✅ visible + editable | Same. |

---

## D. Web display (`apps/web`)

| Surface | Verify |
|---|---|
| Any page (e.g. `/es/`) loaded as anonymous | When no announcement is active, no banner renders. When an `info` / `warning` / `danger` announcement is active, the matching tone renders. Banner appears between header and main content. |
| Dismiss flow | Click the × on a dismissible item. The `hospeda_ann_dismissed` cookie now contains the id. Reload the page — the banner stays hidden. |
| Cookie persistence | Add a second announcement and dismiss it. Cookie value becomes a CSV of both ids. |
| Date filter | Schedule an announcement with `endsAt` set to "now + 1 minute". After 1 minute, reload and confirm it disappears (without waiting for the 5 min server cache to drop). |
| Locale fallback | Publish an announcement with only `es` filled. Visit `/en/` and confirm the Spanish copy shows (fallback path). |

---

## E. Cross-cutting

| Item | Verify |
|---|---|
| Sidebar | "Mi cuenta" group lists 7 entries in the right order (profile / preferences / notifications / security / data / billing / tags). "Plataforma" group includes the new "Email infrastructure" group with `/platform/email/logs`. |
| Topbar avatar dropdown | For ADMIN+ roles (`accountInMenu: false` in IA), profile + settings dropdown links go to `/account/profile` and `/account/preferences`. |
| Forbidden redirects | Hit `/account/billing` as EDITOR → redirected to `/auth/forbidden`. Hit `/platform/critical` as ADMIN → same. |
| i18n | Switch each role's locale to `en` and `pt`. Confirm the new admin-pages keys for `billing.*`, `announcements.*`, `security.*`, `data.*` render in the expected language. |

---

## Sign-off log

Document each manual run here so reviewers can see the smoke was actually executed:

| Date (ISO) | Executor | PR / commit | Result | Notes |
|---|---|---|---|---|
| 2026-05-29 | _pending_ | PR-4 (`#TBD`) | _pending_ | Initial PR-4 staging smoke. |
| 2026-05-29 | claude-via-playwright (local against `hospeda_test`) | PR #1302 (merged to staging) | NOTES — 2 P1 bugs found | See "Post-merge local smoke notes" section below. |

---

## Post-merge local smoke notes (2026-05-29)

Local re-run of the checklist against `hospeda_test` DB on dev ports 4500/4600/4700 with seeded SUPER_ADMIN, ADMIN, HOST (`host-pro`), and EDITOR. Findings flagged here are independent of PR-4 (they exist on `staging` regardless) and should be opened as separate follow-up issues before promoting `staging` to `main`.

### ✅ Working as documented

- **SUPER_ADMIN tour** — all 16 routes under `/account/*` and `/platform/*` return 200 with the expected `h1`. Lists: `/account/profile` → "Mi Perfil", `/account/preferences` → "Mi Configuración", `/account/notifications` → "Mi Configuración", `/account/security` → "Seguridad", `/account/data` → "Mis datos", `/account/tags` → "Mis Tags Personales", `/account/billing` → "Mi facturación", `/platform/critical` → "Configuración - Portal (Crítico)", `/platform/configuration/seo` → "Configuración - SEO", `/platform/cache/revalidation` → "Revalidación ISR", `/platform/ops/cron` → "Tareas Programadas", `/platform/ops/webhooks` → "Eventos Webhook", `/platform/email/logs` → "Registro de Notificaciones", `/platform/tags/internal` → "Etiquetas internas", `/platform/tags/system` → "Etiquetas de sistema". `/platform/critical/announcements` returned 200 with no `h1` element (uses an `h2` for the list title — cosmetic).
- **HOST tour** — `/account/billing` rendered the full surface (sections: Mi plan, Uso de mi plan, Acciones) for `host-pro@local.test` (plan `owner-pro` seeded). `/account/profile` and `/account/tags` rendered OK.
- **Cross-app announcement creation** — `/platform/critical/announcements/new` form accepted text in es/en/pt + `info` variant + dismissible checkbox; on submit it redirected to `/platform/critical/announcements` and the new item was visible in the list. The public API `GET /api/v1/public/announcements` returned the active announcement immediately after creation.
- **EDITOR negative cases** — `editor@local.test` was redirected to `/auth/forbidden` for both `/account/billing` (missing `billing.view.own`) and `/platform/critical/announcements` (missing `system.maintenanceMode.write`). Both gates work as designed.
- **DB permission grants** — `role_permission` table confirms `system.maintenanceMode` and `system.maintenanceMode.write` are SUPER_ADMIN-only; `billing.view.own` + `subscription.view.own` are granted to every authenticated role except EDITOR. Seed is correct.

### 🚨 P1 — `/platform/critical` page gate is missing (security)

`HOST` and `ADMIN` both reach `/platform/critical` and see the full SUPER_ADMIN page (`h1: "Configuración - Portal (Crítico)"`), instead of being redirected to `/auth/forbidden`. The DB grants for `system.maintenanceMode` are correct (SUPER_ADMIN-only), so the regression is at the TanStack Start route guard layer: `/platform/critical/index.tsx` (and likely siblings under `/platform/critical/*` except `/announcements`) is missing the `beforeLoad` permission check that `/announcements` evidently has. Recommend opening a follow-up branch that adds the `system.maintenanceMode` guard to every `_authed/platform/critical/*` route file, and adds a regression test that hits each one with an ADMIN actor expecting a 302 to `/auth/forbidden`. **This must be fixed before promoting `staging` to `main`** since today a non-superadmin can read (and potentially toggle) global maintenance flags.

### 🚨 P1 — `GlobalAnnouncements.astro` field-name mismatch (banner never renders on web)

`apps/web/src/components/GlobalAnnouncements.astro:35` reads `response.success` to gate the data array, but `ApiResult<T>` (defined in `apps/web/src/lib/api/types.ts:55-58`) exposes the discriminator as `ok`, not `success`. As a result the SSR ternary always falls into `[]`, so no banner is ever rendered on web — the API returns the active announcements, the SSR fetch succeeds, but the component silently treats it as failure. Repro: create any active announcement from `/platform/critical/announcements/new`, then `curl http://localhost:4700/es/` and grep for `global-announcement` — zero matches. Fix is a 1-line change: `response.success ? ... : []` → `response.ok ? ... : []`. The same component should also drop the now-dead `success` import path if any. Tests under `apps/web/test/components/GlobalAnnouncements.test.ts` likely mock the response with `{ success: true, data }` so they pass — those mocks need to be aligned to `{ ok: true, data }` too, otherwise the regression will sneak back in. **This too must be fixed before promoting `staging` to `main`** since the banner is the only visible payoff of PR-4 on the public site.

### ⚠️ Notes / non-blocking observations

- **Better Auth change-password flow** — Login as `superadmin@hospeda.com` redirected to `/auth/change-password` on first sign-in because the seeded user has `setPasswordPrompted: false`. Even after `UPDATE users SET set_password_prompted = true`, the existing session keeps the old snapshot, so a full sign-out + re-login is required to clear the redirect. Documented for future smoke runs — recommend either (a) flipping `setPasswordPrompted: true` in the SUPER_ADMIN seed, or (b) updating this checklist to mention the one-time password change requirement.
- **Admin SSR hydration warning** — `/auth/signin` consistently logs a React hydration mismatch in the dev console (the SSR-rendered "loader" markup differs from the client-rendered form). Functionally harmless (the form ends up interactive after the client reconcile) but adds dev-console noise; consider gating the loader inside a `useHasMounted()` so the SSR pass renders the form directly.
- **API `HOSPEDA_REDIS_URL`** — `apps/api/.env.local` ships with `redis://localhost:6379` while the local docker compose maps Redis to `:6381`. `API_CACHE_ENABLED=false` so the API boots fine, but if anyone enables cache locally the connection will fail. Worth a one-liner fix in `.env.local` (or in `apps/api/.env.example` if there is one).

### Retest after fixes (2026-05-29, same session)

Both P1s above were fixed in PR #1306 (`fix/SPEC-156-pr4-platform-critical-and-banner`, two atomic commits on top of `staging`). Local retest against the same `hospeda_test` setup:

- **`/platform/critical` gate** — verified for all three roles:
  - HOST (`host-pro@local.test`) → `/auth/forbidden` ✅
  - ADMIN (`admin@hospeda.com`) → `/auth/forbidden` ✅
  - SUPER_ADMIN (`superadmin@hospeda.com`) → renders the maintenance + announcements + cache cards as before ✅
  - Permission-gate audit (`apps/admin/test/spec-156/permission-gates.test.ts`) now lists `/platform/critical` with `SYSTEM_MAINTENANCE_MODE` and rejects regressions; 13/13 tests pass.
- **`GlobalAnnouncements` banner** — verified via Playwright + raw HTML:
  - Banner renders on `/es/alojamientos/` (`<div class="global-announcement global-announcement--info" data-announcement-id="…">…Smoke PR-4 — SPEC-156 sign-off…</div>`) ✅
  - Locale switching: `/es/` and `/en/` render `text.es` / `text.en`; `/pt/` renders `text.pt` (verified with a distinct PT copy) ✅
  - Dismiss flow: clicking × sets the `hospeda_ann_dismissed` cookie to the item id; on reload the inline client script keeps the banner in DOM but `display: none` (verified via `getComputedStyle`) ✅
  - Source-based test suite (`apps/web/test/components/GlobalAnnouncements.test.ts`) now asserts the component reads `response.ok` and explicitly NOT `response.success`; 31/31 tests pass.
- **`endsAt` date filter on web** — not re-verified live (DB manipulation + API cache restart cycle was expensive). The filter logic is covered by `apps/web/test/lib/announcements.test.ts`; the live check can be repeated during the staging→main promotion smoke.
- **Locale fallback to `es` when other translations are missing** — not re-verified live because the API rejects items with empty translation strings (Zod schema validation in `AnnouncementsValueSchema` rejects `text.en = ""`). The fallback in `pickAnnouncementText` is covered by unit tests. If the schema later relaxes empty strings, this should be re-tested live.

### Out-of-scope follow-ups surfaced during this run

- Four sibling admin routes lack the same per-route `beforeLoad` guard — `/platform/configuration/seo`, `/platform/cache/revalidation`, `/platform/tags/internal`, `/platform/tags/system`. Same class of bug as `/platform/critical` but lower severity (none expose the maintenance toggle). Sidebar `onMissing: 'hide'` hides the nav link for non-permission roles, but direct URL navigation still loads the page. Recommend a separate PR that adds the guard to each + extends the permission-gate audit accordingly. Tracked at the end of PR #1306's body under "Out of scope".

### Coverage extension (2026-05-29, post-fix smoke)

After the two fix commits in PR #1306 landed, the remaining checklist surface was covered against the same `hospeda_test` setup. Results below extend the smoke beyond the original "SUPER_ADMIN tour + cross-app announcement + EDITOR negative" scope.

#### Section A — HOST `/account/*` tour (completion)

| Route | HOST result | Notes |
|---|---|---|
| `/account/preferences` | ✅ `h1: Mi Configuración` | Page renders, theme/language controls present. |
| `/account/notifications` | ✅ `h1: Mi Configuración` (shared layout / tab) | — |
| `/account/security` | ✅ `h1: Seguridad` | Lists "Cambiar contraseña" link + 16 "Próximamente" stub matches in the main region. |
| `/account/data` | ✅ `h1: Mis datos` | `mailto:soporte@hospeda.com.ar` link present. |

#### Section B — `/account/billing` deep-dive for HOST (`host-pro@local.test`, plan `owner-pro`)

| Section | Result |
|---|---|
| Sections rendered | "Mi facturación", "Mi plan", "Uso de mi plan", "Acciones" ✅ |
| Manage subscription deep-link | `href = http://localhost:4700/es/mi-cuenta/suscripcion`, `target = _blank`, text "Gestionar mi suscripción" ✅ |
| Plan card | Renders empty/error fallback when no billing rows are loaded — copy: "No pudimos cargar tu suscripción…" — consistent with PR-1 fallback behavior. |

Not exercised in this pass: usage bar threshold tones (≥80% warning, ≥95% danger) — would require mutating the seeded plan's `currentUsage` values; the rendering paths are covered by component unit tests, leaving this for a focused QA pass on staging if the threshold UX needs verification under real data.

#### Section C — HOST `/platform/*` tour (mostly forbidden)

| Route | HOST | Notes |
|---|---|---|
| `/platform/critical` | ✅ `/auth/forbidden` | Fix shipped in PR #1306. |
| `/platform/critical/announcements` | ✅ `/auth/forbidden` | T-038 guard works. |
| `/platform/ops/cron` | ✅ `/auth/forbidden` | `requireBillingAccess` (BILLING_READ_ALL) — see ADMIN issue below. |
| `/platform/ops/webhooks` | ✅ `/auth/forbidden` | Same guard. |
| `/platform/email/logs` | ✅ `/auth/forbidden` | Same guard. |
| `/platform/configuration/seo` | ❌ renders `Configuración - SEO` for HOST | OOS bug (already documented above). |
| `/platform/tags/system` | ❌ renders `Etiquetas de sistema` for HOST | OOS bug — same class. |
| `/platform/cache/revalidation` | ⚠️ shows "Cargando…" then client-side redirects to `/dashboard` | Partial guard — UI does not crash but no `/auth/forbidden` either. Worth a small fix to surface a consistent forbidden experience. |
| `/platform/tags/internal` | ⚠️ shows "Cargando…" then client-side redirects to `/dashboard` | Same pattern as `/cache/revalidation`. |

#### Section C — ADMIN `/platform/*` tour (visible per spec, but several blocked)

| Route | ADMIN | Notes |
|---|---|---|
| `/platform/configuration/seo` | ✅ visible | — |
| `/platform/cache/revalidation` | ✅ visible | — |
| `/platform/tags/internal` | ✅ visible | — |
| `/platform/tags/system` | ✅ visible | — |
| `/platform/ops/cron` | 🚨 `/auth/forbidden` | Route uses `requireBillingAccess` (`PermissionEnum.BILLING_READ_ALL`, SUPER_ADMIN-only per `role_permission`). ADMIN gets forbidden even though the checklist says they should see it. Mismatch is at the guard layer — `apps/admin/src/lib/billing-access.ts` was reused for routes that are not billing. |
| `/platform/ops/webhooks` | 🚨 `/auth/forbidden` | Same root cause. |
| `/platform/email/logs` | 🚨 `/auth/forbidden` | Same root cause. |

> **New finding (medium)**: `/platform/ops/{cron,webhooks}` and `/platform/email/logs` all gate on `requireBillingAccess` → `PermissionEnum.BILLING_READ_ALL`, which is granted to SUPER_ADMIN only. The checklist documents these as visible for ADMIN+. Recommend either (a) introducing dedicated permissions (`OPS_READ`, `EMAIL_LOGS_VIEW`) and granting them to ADMIN, or (b) swapping the guard to a permission both roles share. Either way, the audit in `apps/admin/test/spec-156/permission-gates.test.ts` should be extended to lock the chosen permission per route. Lower severity than the `/platform/critical` issue because the ADMIN gap is a wrong-default (over-restrictive) rather than a security hole, but it still blocks the documented ADMIN workflow.

#### Section E — cross-cutting UI

| Item | Result |
|---|---|
| Sidebar "Mi cuenta" group | 7 entries in exact spec order: Mi perfil → Preferencias → Notificaciones → Seguridad → Mis datos → Mi facturación → Mis tags ✅ |
| Topbar avatar dropdown (HOST) | "Mi cuenta" + dropdown icon links route to `/account/profile` and `/account/preferences` ✅ |
| Sidebar "Plataforma" group (SUPER_ADMIN) | 6 links captured: SEO defaults, Configuración crítica, Revalidación ISR, Tags de sistema, Etiquetas internas, **Historial de envíos** (`/platform/email/logs`) ✅ — confirms the new email-infrastructure entry shipped. |
| Sidebar entries for `/platform/ops/{cron,webhooks}` | Not surfaced by the same query; they live in a nested Ops sub-group not captured by `[data-sidebar] a[href^="/platform/"]`. Visually present per SUPER_ADMIN tour (both routes return 200 with correct h1). |

#### Outstanding (low priority, not blocking promotion)

- `endsAt` date-filter live re-verification on web (covered by unit tests).
- `es` locale fallback when `text.en`/`text.pt` are empty — blocked by Zod schema rejecting empty strings; covered by `pickAnnouncementText` unit tests.
- Usage bar tone thresholds in `/account/billing` (≥80%, ≥95%) — covered by component unit tests; not exercised live.
- Sidebar Ops sub-group presence for SUPER_ADMIN — visual presence implied by direct-URL render of `/platform/ops/{cron,webhooks}` returning 200; the sidebar query just didn't pick the nested anchors.

### Follow-up fix shipped (2026-05-29, same session) — PR #1306 commit 3/3

The "ADMIN gets `/auth/forbidden` on `/platform/ops/{cron,webhooks}` + `/platform/email/logs`" finding above was promoted to a fix and pushed to PR #1306 as the third commit (`fix(admin): gate /platform/{ops,email} pages on ACCESS_API_ADMIN instead of billing`). Summary of what changed:

- New helper `apps/admin/src/lib/admin-api-access.ts` exposes `requireAdminApiAccess(context)` that asserts `PermissionEnum.ACCESS_API_ADMIN` (granted to SUPER_ADMIN/ADMIN/CLIENT_MANAGER/EDITOR; denied to HOST/USER/SPONSOR).
- The three route files (`/platform/ops/cron.tsx`, `/platform/ops/webhooks.tsx`, `/platform/email/logs.tsx`) swap the imported guard from `requireBillingAccess` (`BILLING_READ_ALL`, SUPER_ADMIN-only) to `requireAdminApiAccess`.
- `apps/admin/test/spec-156/permission-gates.test.ts` grows from 5 → 8 audited routes and gains a `viaHelper` indirection: when a route delegates to a helper, the assertions read the helper source for the `PermissionEnum.*` reference and the `/auth/forbidden` redirect, plus an extra `it()` checks the route imports + invokes the helper. Test count: 13 → 22, all green.

#### Retest (post-fix #3)

- **`host-pro@local.test`** → `/auth/forbidden` on all three routes ✅ (no `ACCESS_API_ADMIN` grant, gate works).
- **`admin@hospeda.com`** → renders the three pages with the expected `h1`:
  - `/platform/ops/cron` → "Tareas Programadas"
  - `/platform/ops/webhooks` → "Eventos Webhook"
  - `/platform/email/logs` → "Registro de Notificaciones"
- **`superadmin@hospeda.com`** → still works (already had `ACCESS_API_ADMIN` and the previous tour confirmed all three render).
- `pnpm typecheck` on `apps/admin` → green.
- `pnpm exec vitest run test/spec-156/permission-gates.test.ts` → 22/22 pass.

#### Still out of scope (separate follow-up PR needed)

- `/platform/configuration/seo` and `/platform/tags/system` render fully for HOST — no `beforeLoad` guard at all on the route file. Lower severity than the wrong-guard issue (these pages don't expose the maintenance toggle), but they should also receive `requireAdminApiAccess` (or a tag-specific permission) + an audit row.
- `/platform/cache/revalidation` and `/platform/tags/internal` show a brief "Cargando…" then client-side redirect to `/dashboard` for HOST. Inconsistent forbidden UX; should be normalized to a redirect to `/auth/forbidden` like the rest of the gated routes.

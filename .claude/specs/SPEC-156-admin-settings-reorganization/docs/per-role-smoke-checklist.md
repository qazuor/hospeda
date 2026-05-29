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

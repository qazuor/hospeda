---
specId: SPEC-156
title: Admin Settings Reorganization — V1 Page Consolidation
status: draft
complexity: medium
owner: qazuor
created: 2026-05-22
parent: (none)
related:
  - SPEC-154 (admin-config-driven-ia — REQUIRED dependency)
  - SPEC-153 (admin-design-tokens — visual styling for settings pages)
  - SPEC-155 (admin-dashboards-v1 — Mi facturación usage widget shares widget infrastructure)
---

# SPEC-156 — Admin Settings Reorganization

> **Status**: DRAFT — base scope captured during the admin redesign planning session 2026-05-22. Field-level spec locked in `.claude/audit/admin-redesign/proposals/04-settings.md` (v0.3+) after `04b-mi-facturacion-verification.md` audit.

## 1. Origin

Phase 1 audit revealed admin settings are scattered across multiple routes with inconsistent storage:

- User settings: `/me/profile`, `/me/settings`, `/me/change-password`, `/me/accommodations`, `/me/tags` — API persisted.
- Platform settings: `/settings/critical` (localStorage), `/settings/seo` (localStorage), `/revalidation` (API), `/billing/cron` (API, located under Billing), `/billing/webhook-events` (API, under Billing), `/billing/notification-logs` (API, under Billing), `/billing/settings` (API).
- Tag management: `/tags/internal`, `/tags/post-tags`, `/tags/system`, `/tags/user-moderation`.

Owner's principle (Operations vs Configuration split — IA doc §15): infrastructure-level config lives in Plataforma; feature-operations live in the feature's section. Plus a small localStorage→API migration is necessary because SUPER_ADMIN changes to maintenance mode + announcements + SEO defaults must apply platform-wide, not per-browser.

Also: HOST has no self-service billing in admin today. Per `04b-mi-facturacion-verification.md` Option A3 was chosen — thin landing page with usage widget + deep links to web for full management.

## 2. Goal

Reorganize existing settings pages to their new IA locations + add the Mi facturación HOST landing page + perform small localStorage→API migrations + add a minimal Anuncios globales editor.

V1 scope discipline: ONLY existing functionality is reorganized. New features (2FA, sessions, GDPR, OAuth UI, email infra config, etc.) are in `99-future-enhancements.md`.

## 3. Scope

### IN

#### Page relocations (existing pages move to new routes)
- `/me/profile` → `/mi-cuenta/perfil`
- `/me/settings` → `/mi-cuenta/preferencias` + `/mi-cuenta/notificaciones` (split into 2 pages per IA doc §12.5)
- `/me/change-password` → `/mi-cuenta/seguridad/cambiar-password`
- `/me/accommodations` → stays linked from "Mis alojamientos" main menu item (HOST)
- `/me/tags` → `/mi-cuenta/etiquetas` (HOST/EDITOR)
- `/settings/critical` → `/plataforma/critical` + localStorage→API migration
- `/settings/seo` → `/plataforma/configuracion/seo` + localStorage→API migration
- `/revalidation` → `/plataforma/cache/revalidacion`
- `/billing/cron` → `/plataforma/ops/cron`
- `/billing/webhook-events` → `/plataforma/ops/webhooks`
- `/billing/notification-logs` → `/plataforma/email/logs`
- `/tags/internal` → `/plataforma/tags/internas`
- `/tags/system` → `/plataforma/tags/sistema`
- `/tags/post-tags` → linked from Editorial sidebar (same route works)
- `/tags/user-moderation` → linked from Comunidad sidebar (same route works)
- `/billing/settings` → stays under Comercial section

#### New admin pages (V1 only)
- `/mi-cuenta/seguridad` — landing for security (currently only has password change link).
- `/mi-cuenta/datos` — landing pointing to GDPR options (deferred — placeholder with "Próximamente" note in V1).
- `/me/facturacion` (HOST only) — Mi facturación landing per `04-settings.md` §3 (A3):
  - Section 1: Mi plan actual (read-only summary).
  - Section 2: Uso de mi plan (NEW UI consuming existing `GET /api/v1/protected/billing/usage`).
  - Section 3: Actions (deep link to `hospeda.com.ar/mi-cuenta/suscripcion` + download latest invoice if PDF available).

#### Storage migrations (small but real)
- `platform_settings` table created with `(key, value, updatedAt, updatedBy)` columns.
- 2 endpoints: `GET /api/v1/admin/platform-settings/:key`, `PATCH /api/v1/admin/platform-settings/:key`.
- `/plataforma/critical` migrates maintenance mode toggle + announcements from localStorage to API.
- `/plataforma/configuracion/seo` migrates 3 SEO fields from localStorage to API.

#### Small UI additions
- Anuncios globales minimal editor: text (i18n ×3) + variant (info/warning/danger) + dismissible toggle + optional start/end dates. List + create/edit forms. Replaces the current display-only placeholder.
- Honest disclosure labels: SMS/Push notification toggles in `/mi-cuenta/notificaciones` labeled `(no disponible)` until backend wired.

#### URL redirects
- Old URLs redirect to new (301) to avoid breaking external bookmarks.

### OUT
- 2FA setup, sessions list, login history, email change flow (deferred — see `99-future-enhancements.md` §3.1).
- GDPR (export, account pause, account deletion) (deferred — §3.2).
- OAuth provider management UI (deferred — §3.3).
- Notification granularity (per-type × channel matrix, quiet hours) (deferred — §3.4).
- Email infra UI (provider config, DKIM, throttling, templates editor, etc.) (deferred — §3.5).
- Localización UI / Feature flags UI (deferred — §3.5).
- Audit log + impersonation log + permission changes log (deferred — §3.6).
- Multi-banner announcements editor with audience targeting (deferred — kept minimal).
- Danger zone actions beyond cache reset (deferred).
- Full HOST self-service in admin (write actions like cancel subscription, change plan, manage payment methods) (deferred — web app handles these in V1).

## 4. Acceptance criteria

### A. Page relocations
- AC-1: All 15+ listed page relocations work — pages render at new routes, no regression in field functionality.
- AC-2: Old URLs redirect to new URLs with HTTP 301.
- AC-3: Sidebar items for the new locations point to the new routes per SPEC-154 config.

### B. Mi cuenta split
- AC-4: `/mi-cuenta/preferencias` contains theme + language + timezone display fields (existing).
- AC-5: `/mi-cuenta/notificaciones` contains master toggle + 3 channel toggles (Email wired, SMS+Push labeled `(no disponible)`).
- AC-6: `/mi-cuenta/seguridad` landing has password change link + `(próximamente)` items for 2FA / sessions / etc.

### C. Mi facturación HOST landing
- AC-7: `/me/facturacion` exists, accessible only to users with `BILLING_VIEW_OWN` permission.
- AC-8: Section 1 (Mi plan) renders correctly from `GET /api/v1/protected/billing/subscriptions?pageSize=1` + latest invoice fetch.
- AC-9: Section 2 (Uso) renders progress bars per resource consuming `GET /api/v1/protected/billing/usage`. Warning color at 80%, danger at 95%.
- AC-10: Section 3 has working deep link to `hospeda.com.ar/{lang}/mi-cuenta/suscripcion` (with current locale).
- AC-11: "Descargar última factura" link works when latest invoice has `pdfUrl`.

### D. Storage migrations
- AC-12: `platform_settings` table created with appropriate DB migration.
- AC-13: GET + PATCH endpoints implemented with permission gates (`SETTINGS_GENERAL_VIEW` / `SETTINGS_GENERAL_WRITE` for SEO, `MAINTENANCE_MODE_WRITE` for critical).
- AC-14: Maintenance mode toggle persists to DB. Reading from DB on all admin app instances (no per-browser drift).
- AC-15: SEO defaults persist to DB. Web app reads them at SSR time (verify cache invalidation strategy).
- AC-16: Migration script copies any existing localStorage values into DB on first load post-deploy (best-effort, idempotent).

### E. Anuncios globales editor
- AC-17: List view shows current announcements with create/edit/delete actions.
- AC-18: Create form has text ×3 (es/en/pt), variant radio, dismissible toggle, optional start/end dates.
- AC-19: Announcements render in web app + admin app (read-only display, current behavior preserved).

### F. Honest disclosure
- AC-20: SMS notification toggle in `/mi-cuenta/notificaciones` shows `(no disponible)` label + disabled state until backend wired.
- AC-21: Push notification toggle same treatment.

### G. Permission gates per setting area (per `04-settings.md` §7)
- AC-22: Mi cuenta pages require `USER_UPDATE_SELF`.
- AC-23: Mi facturación pages require `BILLING_VIEW_OWN` + `SUBSCRIPTION_VIEW_OWN`.
- AC-24: Plataforma → Configuración general requires `SETTINGS_GENERAL_VIEW` + write permission for edits.
- AC-25: Plataforma → Configuración crítica requires SUPER_ADMIN-only permissions (per `04 §7`).
- AC-26: Comercial → Configuración billing requires `BILLING_SETTINGS_VIEW` / `BILLING_SETTINGS_WRITE`.

## 5. Technical approach

1. **DB migration** — create `platform_settings` table (Drizzle migration).
2. **API endpoints** — `GET /admin/platform-settings/:key` + `PATCH`. Add to `apps/api/src/routes/admin/`.
3. **Backend service** — `platform-settings.service.ts` in `service-core` with cache invalidation logic.
4. **Storage migration helpers** — small client-side migration that on first load reads localStorage, POSTs to API if not already in DB, and clears localStorage entries. Idempotent.
5. **Route relocations** — for each old path, create new path file + delete old. Add redirects in TanStack Start's redirect logic.
6. **Page splitting (Mi cuenta)** — `/me/settings` split into `/mi-cuenta/preferencias` and `/mi-cuenta/notificaciones` with shared backend update logic.
7. **Mi facturación landing** — new route file. Composed of 3 section components: `SubscriptionSummary`, `PlanUsage`, `BillingActions`. Reuses widget infrastructure from SPEC-155 where applicable.
8. **Anuncios editor** — small CRUD form for `platform_settings.announcements` key (JSON array of announcement objects).
9. **Honest disclosure** — add `disabled` + label modifier to SMS/Push toggles in `/mi-cuenta/notificaciones`.
10. **Smoke test** — full settings tour per role, verify all 26 acceptance criteria.

## 6. Task breakdown (atomic, complexity ≤ 4)

Estimated 24-28 tasks.

Indicative breakdown:
- DB + API: 4 tasks (migration, GET endpoint, PATCH endpoint, service-core wiring).
- Storage migration helpers: 2 tasks (localStorage→DB script for SEO + Critical).
- Page relocations: 8-10 tasks (one per page move + redirect setup).
- Mi cuenta split: 2 tasks (preferencias page + notificaciones page).
- Mi facturación landing: 3 tasks (route + 3 section components).
- Anuncios editor: 2 tasks (list view + create/edit form).
- Honest disclosure: 1 task.
- Permission gates audit: 1 task.
- Smoke testing: 2 tasks (per role manual smoke + automated acceptance test).

## 7. Risks

| Risk | Mitigation |
|------|------------|
| URL redirects break external integrations / bookmarks | Use 301 redirects. List old paths in CHANGELOG. Add explicit redirect tests. |
| localStorage→DB migration loses user data | Migration helper is idempotent + read-only on first run. If DB write fails, localStorage is preserved. |
| Mi facturación deep links break if web app changes its `/mi-cuenta/suscripcion` route | Link uses env var `PUBLIC_WEB_URL` + path constant; if web changes, update constant in one place. |
| Cache invalidation for SEO defaults — web SSR may serve stale data | Document the cache invalidation strategy. Use ISR revalidation tag on SEO change. |
| Anuncios editor is too minimal — users want more | Documented as V1 minimal in `04-settings.md` §8.2. Full editor in post-V1. |
| Honest disclosure labels confuse non-tech HOST users | "(no disponible)" is clearer than just-disabled. Optionally add tooltip "Próximamente". |
| Permission gate misconfiguration → users see pages they shouldn't | Manual smoke per role + permission gate tests in CI. |

## 8. Rollback plan

- Pre-merge: full smoke test per role, automated acceptance tests pass.
- Post-merge: each relocation is one route file move — revertible individually.
- DB migration: cannot be reverted easily (table stays). Consider feature flag — if Mi facturación / platform-settings UI hidden, table is harmless dead data.
- Catastrophic rollback: revert merge commit. Old routes re-enabled. DB table persists (no schema breakage for other features).

## 9. Dependencies

- **REQUIRED**: SPEC-154 (admin-config-driven-ia) — provides Plataforma + Comercial sections + sidebar refs for the new routes.
- **Optional**: SPEC-155 (dashboards) — Mi facturación's Uso de mi plan widget can reuse the dashboard widget infrastructure for progress bar rendering. If SPEC-155 not done yet, build a standalone usage component.
- **Optional**: SPEC-153 (design tokens) — settings pages look nicer with brand tokens, not required for functional acceptance.

## 10. References

- `.claude/audit/admin-redesign/proposals/04-settings.md` (v0.3+) — field-level spec for every page, storage table, permission gates per area.
- `.claude/audit/admin-redesign/proposals/04b-mi-facturacion-verification.md` (v0.1) — HOST self-service endpoint verification leading to A3 decision.
- `.claude/audit/admin-redesign/proposals/01-information-architecture.md` (v0.10+) — IA decisions, §12 HOST menu, §15 Ops vs Config split.
- `.claude/audit/admin-redesign/proposals/99-future-enhancements.md` — backlog of OUT-OF-V1 features.
- `.claude/audit/admin-redesign/phase-1/05-dashboard-settings.md` — original audit of settings landscape.
- `apps/admin/src/routes/_authed/{me,settings,billing,revalidation,tags}/*` — current settings implementation to be migrated.

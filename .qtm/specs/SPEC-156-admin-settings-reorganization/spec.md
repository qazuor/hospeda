---
specId: SPEC-156
title: Admin Settings Reorganization — V1 Page Consolidation
status: in-progress
complexity: medium
owner: qazuor
created: 2026-05-22
updated: 2026-05-28
parent: (none)
related:
  - SPEC-154 (admin-config-driven-ia — REQUIRED dependency)
  - SPEC-153 (admin-design-tokens — visual styling for settings pages)
  - SPEC-155 (admin-dashboards-v1 — Mi facturación usage widget shares widget infrastructure)
tech-analysis: tech-analysis.md (v0.2, decisions D1-D8 resolved 2026-05-28)
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
- `/mi-cuenta/facturacion` (HOST only) — Mi facturación landing per `04-settings.md` §3 (A3) (path resolved per tech-analysis D8 — consistent with rest of Mi cuenta IA):
  - Section 1: Mi plan actual (read-only summary).
  - Section 2: Uso de mi plan (NEW UI consuming existing `GET /api/v1/protected/billing/usage`). Standalone `<UsageProgressBar>` component, not SPEC-155 widget infra (tech-analysis D5).
  - Section 3: Actions (deep link to `hospeda.com.ar/mi-cuenta/suscripcion` + download latest invoice if PDF available).

#### Storage migrations (small but real)
- `platform_settings` table created with `(key, value, updatedAt, updatedBy)` columns.
- 3 endpoints: `GET /api/v1/admin/platform-settings/:key`, `PATCH /api/v1/admin/platform-settings/:key`, and **`GET /api/v1/public/announcements`** (public, cacheable — added per tech-analysis D2 so web app can render announcements cross-device).
- `/plataforma/critical` migrates maintenance mode toggle + announcements from localStorage to API.
- `/plataforma/configuracion/seo` migrates 3 SEO fields from localStorage to API. PATCH triggers auto-revalidation via `revalidationService.revalidateByEntityType('post')` + revalidate `/` (tech-analysis D7).
- Migration helper: per-browser one-shot with cookie flag `_settings_migrated=true` + scheduled cleanup task ~30 days post-deploy (tech-analysis D4).

#### Small UI additions
- Anuncios globales minimal editor: text (i18n ×3) + variant (info/warning/danger) + dismissible toggle + optional start/end dates. List + create/edit forms. Replaces the current display-only placeholder.
- **Web display Astro component** (per tech-analysis D2): consumes `GET /api/v1/public/announcements`, renders active announcement(s) in layout slot with client-side filter by start/end date + dismissible state in cookie.
- Honest disclosure labels: SMS/Push notification toggles in `/mi-cuenta/notificaciones` labeled `(no disponible)` until backend wired.

#### Permission additions (per tech-analysis D1)
8 new permissions added to `packages/schemas/src/enums/permission.enum.ts` + assigned to role bundles + bundle tests + middleware wiring:
- `SETTINGS_GENERAL_VIEW`, `SETTINGS_GENERAL_WRITE` (ADMIN, SUPER_ADMIN)
- `MAINTENANCE_MODE_WRITE` (SUPER_ADMIN)
- `BILLING_SETTINGS_VIEW`, `BILLING_SETTINGS_WRITE` (ADMIN, SUPER_ADMIN)
- `BILLING_VIEW_OWN`, `SUBSCRIPTION_VIEW_OWN` (HOST, ADMIN, SUPER_ADMIN)
- `USER_UPDATE_SELF` (all authenticated roles)

Existing permissions (`SETTINGS_MANAGE`, `SYSTEM_MAINTENANCE_MODE`, `BILLING_READ_ALL`, `BILLING_MANAGE`) kept — V1 just adds finer-grained perms on the new routes; old routes unchanged.

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
- AC-7: `/mi-cuenta/facturacion` exists, accessible only to users with `BILLING_VIEW_OWN` permission.
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
- AC-19: Announcements render in web app via new public Astro component that consumes `GET /api/v1/public/announcements`, with start/end date filter client-side + dismissible state in cookie.
- AC-19b: Admin app preserves current read-only display behavior (legacy localStorage display removed after migration helper runs).

### F. Honest disclosure
- AC-20: SMS notification toggle in `/mi-cuenta/notificaciones` shows `(no disponible)` label + disabled state until backend wired.
- AC-21: Push notification toggle same treatment.

### G. Permission gates per setting area (per `04-settings.md` §7, permissions created per tech-analysis D1)
- AC-22: Mi cuenta pages require `USER_UPDATE_SELF` (new).
- AC-23: Mi facturación pages require `BILLING_VIEW_OWN` + `SUBSCRIPTION_VIEW_OWN` (new).
- AC-24: Plataforma → Configuración general requires `SETTINGS_GENERAL_VIEW` (new) + `SETTINGS_GENERAL_WRITE` (new) for edits.
- AC-25: Plataforma → Configuración crítica requires `MAINTENANCE_MODE_WRITE` (new, SUPER_ADMIN only) per `04 §7`.
- AC-26: Comercial → Configuración billing requires `BILLING_SETTINGS_VIEW` / `BILLING_SETTINGS_WRITE` (new).
- AC-27: All 8 new permissions present in `permission.enum.ts` with JSDoc + assigned to correct role bundles + bundle tests passing.

## 5. Technical approach

Full details in `tech-analysis.md` (v0.2). High-level steps, organized per the 4-PR strategy (tech-analysis D3):

### PR-1 — `platform_settings` infrastructure
1. **DB migration** — create `platform_settings` table (Drizzle migration). Schema in `packages/db/src/schemas/platform/`.
2. **Zod schemas** — `PlatformSettingsKeySchema` (enum) + per-key value schemas + discriminated union response in `packages/schemas/src/platform-settings/`.
3. **Backend service** — `PlatformSettingsService extends BaseCrudService` in `packages/service-core/src/services/platform-settings/`. Override `update()` to auto-revalidate when key is `seo.defaults` (tech-analysis D7).
4. **Admin API endpoints** — `GET /api/v1/admin/platform-settings/:key` + `PATCH /api/v1/admin/platform-settings/:key`. Permission gate via discriminated key (`SYSTEM_MAINTENANCE_MODE` for critical keys, `SETTINGS_GENERAL_WRITE` for SEO).
5. **Public announcements endpoint** — `GET /api/v1/public/announcements`, cacheable, no auth.
6. **8 new permissions** — add to `permission.enum.ts` + assign to role bundles + bundle tests + middleware wiring (tech-analysis D1).

### PR-2 — Page relocations + IA config
7. **Route relocations** — for each old path, create new path file (move logic, no rewrite). Old path becomes a thin TanStack `beforeLoad` redirect file (`redirect({ to: NEW_PATH, permanent: true })`) per tech-analysis D6.
8. **Page splitting (Mi cuenta)** — `me/settings.tsx` split into `mi-cuenta/preferencias.tsx` and `mi-cuenta/notificaciones.tsx` with shared backend update logic.
9. **IA config update** — `apps/admin/src/config/ia/sidebars.ts` + `roles/*.ts` to add Plataforma/Comercial sections and re-point items to new routes.
10. **Honest disclosure** — add `disabled` + `(no disponible)` label modifier to SMS/Push toggles in `mi-cuenta/notificaciones.tsx`.

### PR-3 — localStorage→API migration helper (depends on PR-1)
11. **Migration helper** — per-browser one-shot in admin app: on first load post-deploy, if `localStorage[KEY]` exists AND server has no value, PATCH to API + set cookie `_settings_migrated=true`. Idempotent on subsequent loads (cookie skip). Scheduled cleanup task ~30 days post-deploy (tech-analysis D4).
12. **`/plataforma/critical/index.tsx`** and **`/plataforma/configuracion/seo.tsx`** — rewrite data source from localStorage to TanStack Query against new admin endpoints.

### PR-4 — Mi facturación HOST + anuncios + web display + smoke
13. **Mi facturación landing** — `apps/admin/src/routes/_authed/mi-cuenta/facturacion.tsx` composes 3 sections: `SubscriptionSummarySection`, `PlanUsageSection` (with standalone `<UsageProgressBar>` per tech-analysis D5), `BillingActionsSection`. Permission gate `BILLING_VIEW_OWN` + `SUBSCRIPTION_VIEW_OWN`.
14. **Anuncios editor** — CRUD form for `platform_settings.announcements` key (JSON array of announcement objects) at `/plataforma/critical/anuncios/`.
15. **Web display Astro component** — new component in `apps/web/src/components/announcements/` consumes `GET /api/v1/public/announcements`, renders in layout slot with client-side date filter + dismissible cookie state (tech-analysis D2).
16. **Smoke test** — full settings tour per role using SPEC-143 dev test users (`*@local.test`), verify all 27 acceptance criteria.

## 6. Task breakdown (atomic, complexity ≤ 4)

Estimated **37-43 tasks** (revised from initial 24-28 per tech-analysis D1 expansion + D2 web display + per-PR quality gates). 4 PRs in order per tech-analysis D3.

Indicative breakdown by PR:

**PR-1 — `platform_settings` infrastructure (9-10 tasks)**
- DB migration + schema model: 2 tasks.
- Zod schemas (key enum, per-key value schemas, discriminated response): 1 task.
- `PlatformSettingsService` extending `BaseCrudService` (with SEO revalidation hook): 1 task.
- Admin endpoints (`GET` + `PATCH`): 2 tasks.
- Public announcements endpoint: 1 task.
- 8 new permissions in `permission.enum.ts` + role bundles + bundle tests + middleware wiring: 2-3 tasks.

**PR-2 — Page relocations + IA config (10-12 tasks)**
- Page relocations + 301 redirects: 8-9 tasks (one per route group: `me/*`, `settings/*`, `revalidation`, `billing/*`-to-`plataforma/*`, `tags/*`-to-`plataforma/tags/*`).
- Mi cuenta split (`me/settings` → preferencias + notificaciones): 1 task.
- New empty landings (`mi-cuenta/seguridad/index`, `mi-cuenta/datos`): 1 task.
- IA config update (`sidebars.ts` + `roles/*.ts` + tests): 1 task.
- Honest disclosure labels on SMS/Push toggles: 1 task.

**PR-3 — localStorage→API migration helper (3-4 tasks, depends on PR-1)**
- Migration helper utility + cookie flag + cleanup hook: 1 task.
- `/plataforma/critical/index.tsx` rewrite (data source localStorage → API): 1 task.
- `/plataforma/configuracion/seo.tsx` rewrite (data source localStorage → API): 1 task.
- Auto-revalidation wiring verification + test: 1 task.

**PR-4 — Mi facturación + anuncios + web display (11-13 tasks)**
- Mi facturación landing route + permission gate: 1 task.
- `SubscriptionSummarySection` component: 1 task.
- `PlanUsageSection` + standalone `<UsageProgressBar>`: 1 task.
- `BillingActionsSection` with deep links: 1 task.
- Anuncios editor — list view: 1 task.
- Anuncios editor — create/edit form (i18n ×3 + variant + dismissible + dates): 1 task.
- Web Astro `<GlobalAnnouncements>` component (consume public endpoint + render + dismissible cookie): 1-2 tasks.
- Per-role smoke test (using SPEC-143 `*@local.test` users): 1-2 tasks.
- Permission gate audit + automated AC test: 1 task.
- Quality gate per PR (typecheck + lint + test) ×4: 4 tasks.

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

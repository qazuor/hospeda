---
proposal: settings
status: DRAFT (in active discussion)
version: 0.3
date-started: 2026-05-22
last-updated: 2026-05-22
depends-on: 01-information-architecture.md (v0.7+), 02-config-schema.md (v0.2+)
related: 04b-mi-facturacion-verification.md
scope: V1 = reorganize UI for SETTINGS THAT ALREADY EXIST IN CODE. Aspirational items moved to 99-future-enhancements.md
---

# Settings Pages — V1 reorganization (existing fields only)

> **Scope rule**: this document covers ONLY settings whose **code already exists** in `apps/admin`. The redesign reorganizes WHERE these settings live (per IA doc §15 Operations vs Configuration split), NOT what fields exist. New features (2FA, sessions, GDPR, email infra UI, etc.) are tracked in `99-future-enhancements.md`.

## How to read this doc

For each settings area, we list:

- **Current location** (where it lives in the existing codebase)
- **New location** (where it goes in the redesigned IA)
- **Fields** that exist today (no field is added unless explicitly noted as "small migration work")
- **Persistence change** if applicable (e.g., localStorage → API)

---

## 1. Principles

### 1.1 V1 scope = reorganization, not new features

- Every field listed must already exist in `apps/admin/src/routes/_authed/{me,settings,billing,revalidation,tags}/*`.
- "New" features (2FA, sessions, GDPR, OAuth UI, etc.) live in `99-future-enhancements.md` until promoted.
- Small storage migrations (localStorage → API for SEO + Critical) are in V1 scope because the new IA requires cross-device consistency for platform-wide settings.

### 1.2 Storage rule (clean up existing inconsistency)

Per Phase 1 audit finding ("3 platform-settings routes with mixed storage"):

| Today (inconsistent) | V1 target |
|----------------------|-----------|
| `/me/profile` → API ✓ | API (no change) |
| `/me/settings` → API ✓ | API (no change) |
| `/settings/critical` → localStorage | **migrate to API** in V1 |
| `/settings/seo` → localStorage | **migrate to API** in V1 |
| `/billing/settings` → API ✓ | API (no change) |
| UI ephemeral (sidebar collapsed) → localStorage | localStorage (kept — appropriate) |

Storage migration for `/settings/critical` and `/settings/seo` is part of V1 because **SUPER_ADMIN changes to maintenance mode or SEO defaults must apply platform-wide**, not per-browser-per-user. This is a real bug today.

---

## 2. Mi cuenta (universal — all 4 active roles)

Reorganization: same fields as today, but `Mi cuenta` becomes a clearly-grouped area (per IA §12.5 for HOST in main menu, §13 topbar avatar for others).

### 2.1 Perfil (existing `/me/profile`)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Display name | text | yes | existing |
| First name | text | yes | existing |
| Last name | text | yes | existing |
| Phone | tel | no | existing |
| Avatar URL | URL | no | existing |
| Bio | textarea | no | existing |
| Email | read-only | – | existing (with verification badge) |
| Role | read-only badge | – | existing |

**No changes to fields.** Just lives under "Mi cuenta → Perfil" in the new IA.

### 2.2 Preferencias (existing `/me/settings`)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| Tema web | radio (system/light/dark) | system | existing |
| Tema admin | radio (system/light/dark) | system | existing |
| Idioma UI web | buttons (es/en/pt) | es | existing |
| Idioma UI admin | buttons (es/en/pt) | es | existing |
| Timezone | read-only (auto-detected) | browser tz | existing — display only badge today |

**No changes to fields.**

### 2.3 Notificaciones (existing `/me/settings`)

| Field | Type | Default | Wired? |
|-------|------|---------|--------|
| Enable Notifications (master) | toggle | true | yes |
| Allow Email Notifications | toggle (child) | true | yes — wired to email pipeline |
| Allow SMS Notifications | toggle (child) | false | NO — toggle exists, backend not wired |
| Allow Push Notifications | toggle (child) | false | NO — toggle exists, backend not wired |

**Note**: SMS and Push toggles exist as UI but are NOT wired to a backend. They persist user intent but nothing actually sends SMS/push today. Honest disclosure for V1.

**Possible V1 work**: add a `(no disponible)` label next to SMS / Push toggles until they're wired. Decided in implementation.

### 2.4 Cambiar contraseña (existing `/me/change-password`)

Existing 3-step flow:
- Current password
- New password (with live strength meter)
- Confirm password

Validation rules: 8+ chars, uppercase, lowercase, number, special character. **No changes.**

### 2.5 Read-only display elements (existing)

- Auth Provider info (e.g., "Managed via Better Auth")
- Security tip callout

These stay as-is in the reorganized "Mi cuenta → Perfil" area for informational context.

---

## 3. Mi facturación (HOST only — A3 plan locked)

Per IA §12.4, HOST has "Mi facturación" as a main menu item. After verification audit (`04b-mi-facturacion-verification.md`), V1 = **Option A3**: thin landing page that surfaces existing data + links to the web app for full management.

### Decision rationale

Verification revealed:

- Web app already has a polished `SubscriptionDashboard.client.tsx` for HOST self-service (`/{lang}/mi-cuenta/suscripcion`).
- Backend has comprehensive read endpoints (qzpay-hono + custom hospeda) for subscriptions, invoices, payments, plans, add-ons, promo codes, usage.
- NO admin pages exist today for HOST billing self-service.
- NO payment-method management endpoints exist anywhere.
- The `/api/v1/protected/billing/usage` endpoint exists but no UI consumes it (high-value low-cost addition).

Building full admin pages for invoices/payments/add-ons/promos/payment-methods would violate V1 scope (= reorganize existing UI). The HYBRID path the verification agent recommended is post-V1 territory and is captured in `99-future-enhancements.md`.

### V1 structure: single landing page

"Mi facturación" in admin = ONE landing page (not 5 sub-pages as the IA initial sketch suggested). Sections within the page:

#### Section 1: Mi plan actual (read-only summary)

| Field | Source |
|-------|--------|
| Nombre del plan + badge de estado (active/trial/past-due/etc.) | `GET /api/v1/protected/billing/subscriptions` (list, pick first active per 03b §3) |
| Próximo cobro: fecha | same |
| Método de pago: brand + last4, o "MercadoPago" fallback | same |
| Última factura: link "Descargar PDF" si `pdfUrl` está disponible | `GET /api/v1/protected/billing/invoices?pageSize=1&sort=date_desc` |

#### Section 2: Uso de mi plan (NEW UI, existing endpoint)

| Field | Source |
|-------|--------|
| Lista de límites por recurso (alojamientos, imágenes, almacenamiento, etc.) | `GET /api/v1/protected/billing/usage` (exists, not consumed today — per 03b §4) |
| Barra de progreso por recurso con thresholds: 80% warning, 95% danger, 100% bloqueo | client-side calc |
| Indicador "Actualizar plan" cuando algún recurso está cerca del límite | client-side conditional |

This is the **ONE genuinely new piece of admin UI** in Mi facturación. Builds on an endpoint that exists but is currently unconsumed.

#### Section 3: Actions

- **CTA primaria**: "Administrar mi suscripción en hospeda.com.ar" → deep link a `/{lang}/mi-cuenta/suscripcion` (la UI completa del web)
- **CTA secundaria**: "Cambiar de plan" → deep link a `/{lang}/suscriptores/planes`
- **Link inline**: "Descargar última factura" (si PDF disponible)

### What HOST does NOT do in admin (deferred to web)

All write operations + multi-page data exploration:

- Cancel subscription (today still routes to email per SPEC-147 — same in web)
- Change plan (web checkout flow)
- Manage payment methods (no endpoints exist anyway)
- Browse invoice history beyond latest
- Add-ons purchase / cancel
- Promo code application

### Sidebar structure

The IA doc §12 originally listed 5 sub-items under "Mi facturación" (4.1-4.5). For A3 / V1, Mi facturación has **1 sidebar item = the landing page**. The sub-items 4.1-4.5 become sections WITHIN the page, not separate routes. (IA doc §12 will be updated in next version.)

### V1 work involved

1. Build the landing page: 1 admin page (route `/me/facturacion`) with 3 sections.
2. Wire `GET /api/v1/protected/billing/usage` (only new data binding in admin V1).
3. Read-only display of current subscription summary (consumes existing list endpoints with pageSize=1 + client-side pick).
4. Deep links to web app for write actions.

**Scope**: ~1 page + 1 hook for usage + 1 hook for subscription summary. Honest small addition; not feature creation.

---

## 4. Plataforma → Configuración general (ADMIN+)

Reorganization: scatter today, single section in redesign.

### 4.1 SEO defaults (existing `/settings/seo`)

| Field | Type | Storage today | V1 |
|-------|------|---------------|-----|
| Meta title template | text | localStorage | **migrate to API** |
| Meta description default | textarea | localStorage | **migrate to API** |
| OG image default | URL | localStorage | **migrate to API** |
| Sitemap generation | badge (read-only display) | localStorage flag | keep display; backend unchanged |
| robots.txt | badge (read-only display) | localStorage flag | keep display; backend unchanged |

**V1 work**: create `platform_settings` table + endpoints + migrate the 3 SEO fields from localStorage. The page UI stays similar.

### 4.2 General info (NEW — was previously nothing)

Out of V1 scope. Site name, logo, favicon, public contact info etc. don't have admin UI today. Deferred (see `99-future-enhancements.md` §3.5).

### 4.3 Localización (NEW)

Out of V1 scope. Today env-driven. Deferred.

### 4.4 Feature flags (NEW)

Out of V1 scope. Today env-driven. Deferred.

---

## 5. Plataforma → Cache y deploy (ADMIN+)

Reorganization: existing `/revalidation` moves here.

### 5.1 ISR / revalidación (existing `/revalidation`)

3 existing tabs preserved:

- **Config**: per-entity revalidation rules (existing)
- **Logs**: revalidation history (existing)
- **Manual**: trigger specific paths (existing)

No field changes.

---

## 6. Plataforma → Operaciones del sistema (ADMIN+)

Reorganization: existing routes from `/billing/*` move here per IA §15 (Ops vs Config split — these are infra-level, not billing-specific).

### 6.1 Cron jobs (existing `/billing/cron` → moves to `/plataforma/ops/cron`)

Existing UI preserved:
- List of all cron jobs
- Schedule, last/next run, status
- Manual trigger button per job

No field changes.

### 6.2 Webhook events (existing `/billing/webhook-events` → `/plataforma/ops/webhooks`)

Existing UI preserved:
- Delivery log with filters
- Per-event detail (payload, headers)
- Retry button

No field changes.

### 6.3 Logs de notificaciones (existing `/billing/notification-logs` → `/plataforma/ops/notification-logs`)

Existing UI preserved:
- Email history with filters (status, date range, recipient)

No field changes.

---

## 7. Plataforma → Tags del sistema (ADMIN+)

Reorganization: existing 4 routes consolidated under the same section.

### 7.1 Tags internas (existing `/tags/internal`)
CRUD as-is (index, $id, $id_.edit, new).

### 7.2 Tags de sistema (existing `/tags/system`)
CRUD as-is.

### 7.3 Post tags (existing `/tags/post-tags`)
CRUD as-is. (Note: per IA §13 also referenced from Editorial sidebar — same target route.)

### 7.4 Moderación de tags propuestos por users (existing `/tags/user-moderation`)
Existing pagination view as-is. (Note: per IA §13 lives under Comunidad → Moderación. Same target route.)

No field changes.

---

## 8. Plataforma → Configuración crítica (SUPER_ADMIN ONLY)

Existing `/settings/critical` reorganized.

### 8.1 Maintenance mode (existing)

| Field | Type | Storage today | V1 |
|-------|------|---------------|-----|
| Modo mantenimiento activo | toggle | localStorage | **migrate to API** |

**V1 work**: storage migration. The toggle as-is.

### 8.2 Anuncios globales (existing — display-only)

Today only displays announcements pulled from localStorage (so they're invisible to other users — buggy). The page shows a list but no editor.

**V1 work**: storage migration to API. Light editor for create/edit (text + dismissible toggle + start/end dates). This is small enough to include in V1.

| Field | Type | Notes |
|-------|------|-------|
| Mensaje (es/en/pt) | textarea ×3 | new editor — small UI add |
| Variante | radio (info/warning/danger) | new — small |
| Dismissible | toggle | new — small |
| Inicio / Fin (opcional) | datetime each | new — small |

**Note**: this is the SMALLEST viable announcements feature. Multiple-banner editor with audience targeting moves to `99-future-enhancements.md`.

### 8.3 Cache management (existing button)

`POST /api/v1/admin/metrics/reset` — existing button. Becomes part of this section as-is.

### 8.4 Danger zone (existing empty dev stub)

Stays empty in V1 unless we decide specific actions to add. Per audit, today this is an empty section with dev-only stub.

**V1 decision**: leave empty. Specific danger actions (drop caches, force MP re-sync, etc.) live in `99-future-enhancements.md`.

---

## 9. Plataforma → Auditoría (SUPER_ADMIN ONLY)

**OUT OF V1 SCOPE** — no audit log code exists today (per Phase 1 audit, dashboard has "Coming Soon" placeholder for audit log).

Deferred to `99-future-enhancements.md` §3.6.

---

## 10. Comercial → Configuración billing (ADMIN+)

Existing `/billing/settings` preserved as-is — same fields, same section in IA.

### 10.1 Trial

| Field | Type |
|-------|------|
| Trial duration (días) | number |
| Auto-block on expiry | toggle |

### 10.2 Payment

| Field | Type |
|-------|------|
| Grace period (días) | number |
| Retry attempts (1-10) | number |
| Retry interval (horas) | number |
| Default currency | select | (ARS by default) |

### 10.3 Webhook (read-only display)

| Field | Type |
|-------|------|
| Webhook URL | display only |
| Webhook secret | display only (masked) |
| Last webhook received | timestamp display |

### 10.4 Notifications

| Field | Type |
|-------|------|
| Send payment reminders | toggle |
| Reminder days before due | number |
| Send receipt on payment | toggle |

**No changes to fields.** Existing endpoint: `PATCH /api/v1/admin/billing/settings`.

---

## 11. What V1 settings work includes

Summary of actual work the V1 settings reorganization requires:

1. **Move existing pages to new IA locations** (per §3-§10 above):
   - `/me/profile`, `/me/settings`, `/me/change-password` → consolidated under "Mi cuenta"
   - `/settings/critical` → Plataforma → Configuración crítica
   - `/settings/seo` → Plataforma → Configuración general → SEO defaults
   - `/revalidation` → Plataforma → Cache y deploy
   - `/billing/cron` → Plataforma → Operaciones → Cron jobs
   - `/billing/webhook-events` → Plataforma → Operaciones → Webhook events
   - `/billing/notification-logs` → Plataforma → Operaciones → Logs de notificaciones
   - `/billing/settings` → Comercial → Configuración billing (stays under Comercial — already is)
   - `/tags/*` routes → Plataforma → Tags del sistema + Editorial/Comunidad references

2. **Small storage migrations** (localStorage → API):
   - SEO defaults (`/settings/seo`)
   - Maintenance mode toggle (`/settings/critical`)
   - Announcements (`/settings/critical`)
   - Requires: `platform_settings` table + 2 endpoints (GET, PATCH)

3. **Small UI additions**:
   - Announcements editor (minimal — text + variant + dismissible + dates)
   - `(no disponible)` label on SMS/Push notification toggles until backend wired

4. **Honest disclosure**: SMS/Push notification toggles disabled or labeled until wired.

**Out of scope for V1** (in `99-future-enhancements.md`): 2FA, sessions, login history, email change, GDPR, OAuth UI, notification granularity, quiet hours, email infra config, localization UI, feature flags UI, audit log, impersonation log, danger zone actions, multi-banner announcements, host self-service billing in admin (TBD per §3).

---

## Open questions

### A. Mi facturación (HOST self-service in admin) [RESOLVED 2026-05-22]

Focused audit completed (`04b-mi-facturacion-verification.md`). Decision: **A3 — thin landing page + usage widget + deep links to web**. See §3.

### B. SMS/Push notification toggles UX [OPEN]

Today toggles exist but backends aren't wired. Options:
- (a) Keep toggles, label `(no disponible)`, disable interaction.
- (b) Hide toggles entirely until wired.
- (c) Keep enabled — persists user intent, even if nothing sends.

Recommend (a) — honest + reduces surprise.

### C. Storage migration scope [OPEN]

Storage migrations (localStorage → API) for SEO + Critical settings are small but real work. Confirm they're in V1 scope vs deferred to follow-up.

---

## Decisions log

| Date | Decision | Section |
|------|----------|---------|
| 2026-05-22 | V1 scope = reorganize EXISTING settings UI, not add new features. Aspirational items (2FA, sessions, GDPR, OAuth UI, email infra UI, etc.) moved to `99-future-enhancements.md` | §1.1 |
| 2026-05-22 | localStorage → API migration for SEO defaults + Maintenance mode + Announcements is IN V1 (small but necessary for cross-device platform settings) | §1.2, §11 |
| 2026-05-22 | Mi cuenta keeps existing 4 sub-pages: Perfil, Preferencias, Notificaciones, Cambiar contraseña. NO new sub-pages added in V1 | §2 |
| 2026-05-22 | SMS/Push notification toggles labeled `(no disponible)` until backend wired (honest disclosure) | §2.3 |
| 2026-05-22 | Mi facturación (HOST) needs verification audit before locking — qzpay-hono endpoints + admin UI mapping | §3 |
| 2026-05-22 | Mi facturación (HOST) audit COMPLETE — A3 plan locked: thin admin landing page with (1) read-only subscription summary, (2) usage/limits widget consuming existing `/protected/billing/usage` endpoint, (3) deep links to web for all write actions. Sub-items 4.1-4.5 become sections within ONE page (not separate routes). HYBRID full-admin-pages approach deferred to post-V1 | §3, 04b |
| 2026-05-22 | Usage/limits widget is the ONE genuinely new admin UI in Mi facturación V1 — endpoint exists, no UI consumes it today | §3 (Section 2) |
| 2026-05-22 | Auditoría (SUPER_ADMIN) section deferred to post-V1 — no audit log code exists today | §9 |
| 2026-05-22 | Anuncios globales gets minimal editor in V1 (text + variant + dismissible + dates). Multi-banner editor with audience targeting deferred | §8.2 |
| 2026-05-22 | Danger zone empty in V1 (current state preserved). Specific actions deferred | §8.4 |

---

## Change log

| Date | Version | Change |
|------|---------|--------|
| 2026-05-22 | 0.1 | Initial draft — went out of scope inventing 2FA, sessions, GDPR, email infra UI, notification matrix, etc. |
| 2026-05-22 | 0.2 | **Reality pass** — full rewrite scoped to V1 = reorganize EXISTING settings only. Aspirational features moved to `99-future-enhancements.md`. Reduced from ~815 lines to ~350. Sections: Mi cuenta (4 existing sub-pages), Mi facturación (HOST — needs audit, §3), Plataforma → Configuración general (SEO migration), Cache y deploy (revalidación), Operaciones (cron + webhooks + notification logs relocated from /billing/*), Tags del sistema (4 existing routes consolidated), Configuración crítica (maintenance + announcements + cache mgmt; localStorage→API migrations), Comercial → Configuración billing (no changes). Auditoría section deferred. |
| 2026-05-22 | 0.3 | **Mi facturación verification applied** — §3 rewritten with A3 plan: thin admin landing page with (1) subscription summary read-only, (2) usage/limits widget (NEW UI consuming existing `/protected/billing/usage`), (3) deep links to web for all write actions. Sub-items 4.1-4.5 collapse to sections within ONE page. Open Q-A resolved. Cross-reference added to `04b-mi-facturacion-verification.md`. |

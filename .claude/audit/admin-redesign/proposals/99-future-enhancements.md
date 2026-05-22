---
proposal: future-enhancements
status: BACKLOG
version: 0.1
date-started: 2026-05-22
last-updated: 2026-05-22
purpose: catch-all for features that came up during the V1 admin redesign discussion but are OUT OF SCOPE for V1 because they require NEW code (not just UI reorganization)
---

# Future Enhancements (post-V1)

> **Scope rule of V1**: the admin redesign reorganizes the UI for features whose **code already exists**. Everything else moves here as explicit backlog so it's not lost.

## How to use this doc

- Items here are NOT in V1 scope.
- Each item has a **trigger condition** for promotion (when it makes sense to build).
- When an item is promoted, it becomes its own SPEC. Move the entry out of here and link to the SPEC.

---

## 1. Inicio sidebar items (originally proposed in IA §19)

The "User Home Hub" sidebar was proposed with 7 items. In V1 only the ones with existing code are kept (see IA §19 v0.8). These move here:

### 1.1 Mi inbox — in-app notifications page
- **Today**: `/notifications` route exists as a localStorage demo. Backend has email pipeline only.
- **Needed**: `user_notifications` DB table, 3 API endpoints (list/mark-read/dismiss), backend triggers at notification source points, frontend wired to API.
- **Promote when**: in-app notifications backend is built. Per Phase 2 audit item #9, estimated 4-5 PRs / 2-3 days.

### 1.2 Mi actividad reciente — personal audit log
- **Today**: no audit log exists at all (dashboard has "Coming Soon" placeholder).
- **Needed**: `audit_log` table, write at every admin action, API endpoint with filters, frontend.
- **Promote when**: platform audit log is built. Also unblocks Plataforma → Auditoría (SUPER_ADMIN).

### 1.3 Mis favoritos — pinning shortcuts
- **Today**: no pinning/favorites system.
- **Needed**: `user_favorites` table, pin/unpin actions on sidebar items, frontend integration.
- **Promote when**: there's user demand for it. Low priority.

### 1.4 Centro de ayuda — in-app tutorials/FAQ
- **Today**: no in-app help.
- **Needed**: help content management (markdown files or CMS), help drawer/page renderer, contextual triggers.
- **Promote when**: HOST onboarding becomes a focus or support tickets reveal repetitive issues.

### 1.5 Novedades — changelog/announcements
- **Today**: no changelog system. Critical settings has a single global announcement (localStorage display-only).
- **Needed**: `announcements` table (or extend critical_settings), edit UI per release, audience targeting, rendering.
- **Promote when**: product communications becomes a priority.

---

## 2. Dashboard widgets (originally proposed in Dashboards doc 03)

Widgets that were proposed without backing data sources move here.

### HOST dashboard

| Widget | Needs |
|--------|-------|
| Próximos check-ins | Booking system (not in code today) |
| Ocupación promedio | Booking system + analytics |
| Ingresos del mes | Per-host revenue tracking (today only platform billing exists) |
| Welcome callout with dynamic next-action | `host.next-action.own` resolver service |

### EDITOR dashboard

| Widget | Needs |
|--------|-------|
| Calendario editorial cross-content (posts + events + newsletter) | Aggregator endpoint composing the 3 sources by date |
| Top posts by engagement | Engagement tracking (views, time-on-page). Status uncertain — verify with analytics audit. |

### ADMIN / SUPER_ADMIN dashboard

| Widget | Needs |
|--------|-------|
| Churn (monthly) | Churn calculation in billing metrics |
| Conversions del mes | Define what counts as conversion + tracking |
| Sentry errors (24h) | Sentry-to-admin integration |
| Failed crons | Cron failure filter + dashboard widget |
| Audit log preview | Audit log system (see §1.2 above) |
| Welcome callout dynamic | Same as HOST |

---

## 3. Settings — features not yet in code (originally proposed in Settings doc 04)

### 3.1 Security extensions
- **2FA**: TOTP + backup codes. Requires Better Auth 2FA integration + UI wizard.
- **SMS 2FA**: requires SMS provider + costs per message. Defer.
- **Active sessions list**: requires session tracking with device/IP/last-activity. Better Auth supports this but UI doesn't exist.
- **Login history**: log of recent logins (date, IP, user-agent, result). Requires logging at auth + UI.
- **Email change with grace period**: requires email-change workflow with verification + revert window.

### 3.2 GDPR / Privacy
- **Data export**: async job that gathers all user data, generates JSON+CSV zip, emails link.
- **Account pause**: soft-deactivation reversible flag (`users.status = 'paused'`).
- **Account deletion with grace**: 30-day grace before permanent deletion, with cancel option.

### 3.3 Connected accounts
- **OAuth provider management UI**: connect/disconnect Google/Facebook/etc. Backend supports auth via Better Auth, but UI to manage links doesn't exist.

### 3.4 Notifications granularity
- **Per-type notification matrix**: 9+ notification types × 4 channels (email/in-app/push/SMS) with individual toggles. Today only master + 3 channel toggles exist (and only email is wired).
- **Quiet hours**: do-not-disturb window with security override.
- **Push web (browser)**: requires service worker + push subscription management.
- **SMS notifications**: requires SMS provider.

### 3.5 Platform configuration
- **Email infrastructure UI**: provider, sender identity, DKIM/SPF/DMARC, throttling, rate limits, system templates editor, unsubscribe page customization, delivery logs centralized view. Today all env-driven.
- **Localización UI**: enabled languages/currencies/timezones, defaults, date/time formats. Today env-driven.
- **Feature flags UI**: enable/disable flags with per-role/per-user overrides. Today env-driven.
- **Critical config extensions**: maintenance mode scheduling (start/end + IPs allowlist), multiple global announcements with editor + audience targeting.
- **Danger zone actions**: drop all caches, recompute analytics, reset metrics, force re-sync MercadoPago, reset all user passwords. Each requires backend implementation + typed confirmation flow.

### 3.6 Audit & impersonation
- **Audit log of admin actions**: full log with diff, filterable. Critical for security.
- **Impersonation log**: who impersonated whom, when, why, duration, what they did during.
- **Permission changes log**: grants/revokes per user with reason.
- **Privilege escalation prevention**: per Phase 2 audit, SUPER_ADMIN can currently impersonate another SUPER_ADMIN. Needs hierarchy check.

These are also security gaps flagged in the Phase 2 audit (`10-impersonation.md`).

### 3.7 Mi facturación for HOST (admin-side self-service)
- **Today**: `/me/accommodations` exists (owner-filtered list). No `/me/billing` or `/me/subscription` in admin.
- **Needed**: API endpoints `/api/v1/protected/billing/me/*` (some may exist via qzpay) + frontend pages: Mi plan, Métodos de pago, Historial de facturas, Uso del plan, Próximo cobro.
- **Verify**: web app may already expose this. The redesign question is whether HOST also accesses it from admin or only from web.

---

## 4. Bulk operations across CRUDs (originally in Phase 2 audit item #6)

- **What exists**: `BulkOperationsToolbar`, `SelectionCheckbox`, `SelectAllCheckbox` components fully built and tested.
- **What's missing**: integration into ANY CRUD page. Zero CRUDs use them today.
- **Promote when**: integration sprint to wire bulk ops into accommodations + posts + users (the highest-volume CRUDs).

---

## 5. CommandPalette real implementation (originally in Phase 2 audit item #8)

- **Today**: skeleton UI with Cmd+K trigger + "Coming Soon" placeholder.
- **Needed**: see Phase 2 audit `08-command-palette.md` for full scope. Spec-worthy on its own.

---

## 6. Visual identity tokens alignment (originally planned as doc 05)

- **Today**: admin uses shadcn defaults; web uses custom oklch palette + 3-font system (Roboto/Geologica/Caveat). Zero shared tokens.
- **Needed**: consolidate tokens into a shared source (`packages/tailwind-config` extended or new `packages/design-tokens`). Admin consumes via Tailwind theme; web consumes via CSS custom properties. Same hex/oklch, same fonts, same spacing/radius, same dark mode strategy.
- **Estimated**: 1-2 weeks of design + dev work.

---

## Change log

| Date | Version | Change |
|------|---------|--------|
| 2026-05-22 | 0.1 | Initial backlog created during V1 scope-correction. Items moved here from proposals 01 §19 (Inicio sidebar aspirational items), 03 (dashboards aspirational widgets), 04 (settings aspirational features). Includes also bulk ops integration, CommandPalette implementation, visual identity tokens. |

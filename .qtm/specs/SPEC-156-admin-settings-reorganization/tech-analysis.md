---
specId: SPEC-156
artifact: tech-analysis
version: 0.2
status: decisions-resolved
created: 2026-05-28
updated: 2026-05-28
author: claude (handoff session post-SPEC-164)
decisions-resolved:
  D1: create-new-permissions-literal
  D2: add-public-announcements-endpoint-plus-web-display
  D3: four-prs-in-order
  D4: per-browser-one-shot-with-cookie-flag (R4 default applied)
  D5: standalone-usage-progress-bar (R5 default applied)
  D6: tanstack-beforeload-per-old-path (R6 default applied)
  D7: auto-revalidate-on-patch (R7 default applied)
  D8: mi-cuenta-facturacion
inputs:
  - spec.md (v draft)
  - .claude/audit/admin-redesign/proposals/04-settings.md (v0.3)
  - .claude/audit/admin-redesign/proposals/04b-mi-facturacion-verification.md (v0.1)
  - .claude/audit/admin-redesign/proposals/01-information-architecture.md (§12, §13, §15)
  - Explore agent report (current code map, 2026-05-28)
---

# SPEC-156 — Tech analysis

This is the technical translation of the SPEC-156 scope into concrete code changes: rutas a tocar, schemas a crear, configs a editar, services a wirear, riesgos por bloque. It does NOT atomize tasks (next step: `/task-master:task-from-spec`).

## 1. Executive summary

SPEC-156 cierra Admin V1. Tres bloques de trabajo independientes y un cuarto chico:

1. **Page relocations** (B1) — mover ~15 rutas TanStack Start + URL redirects (301).
2. **Platform settings infrastructure** (B2) — nueva tabla `platform_settings` + 2 endpoints admin + service-core + migración localStorage→API para SEO + Critical + Announcements.
3. **Mi facturación HOST landing** (B3) — 1 ruta `/mi-cuenta/facturacion` con 3 secciones, consume endpoints `/protected/billing/*` que ya existen. Una pieza UI genuinamente nueva (usage progress bars).
4. **Pequeños extras** (B4) — anuncios editor minimal + honest disclosure labels en SMS/Push + permission gate audit.

**Total impact estimado**: ~4,135 LOC actuales en rutas afectadas + nueva tabla + 2 endpoints admin + 1 endpoint público + 1 nuevo widget. NO modifica business logic existente — es 95% reorganización + 5% nuevo (Mi facturación landing + announcements editor + platform_settings).

**Dependency status**:
- SPEC-154 (config-driven IA) ✓ MERGED — `apps/admin/src/config/ia/` modular existe.
- SPEC-155 (dashboards V1) ✓ MERGED — widget infrastructure (5 widgets + 5 role configs) existe; pero `ProgressBarWidget` NO existe (D5).
- SPEC-153 (design tokens) ✓ MERGED — visual tokens disponibles.

## 2. Map of changes by layer

### 2.1 Database (`packages/db/`)

| Change | File | Type |
|--------|------|------|
| New table `platform_settings` | `packages/db/src/schemas/platform/platform-settings.dbschema.ts` (NEW DIR) | additive |
| Migration | `packages/db/drizzle/migrations/NNNN_platform_settings.sql` (auto-generated) | additive |
| Schema export | `packages/db/src/schemas/index.ts` | additive |
| Model | `packages/db/src/models/platform-settings.model.ts` (NEW) extending `BaseModel` | additive |

Table shape (per spec §3 storage migrations):
```ts
platform_settings (
  key         varchar(128)  PRIMARY KEY,
  value       jsonb         NOT NULL,
  updated_at  timestamptz   NOT NULL DEFAULT now(),
  updated_by  uuid          NOT NULL REFERENCES users(id),
  -- soft delete excluded: settings are upserted, never deleted
)
```

Keys used in V1: `seo.defaults`, `maintenance.mode`, `announcements.global` (JSON array).

**No drizzle-kit push edge cases**: pure additive table, no triggers, no JSONB CHECK constraints. `pnpm db:generate` + `pnpm db:migrate` standard flow.

### 2.2 Schemas (`packages/schemas/`)

| Change | File | Type |
|--------|------|------|
| `PlatformSettingsKeySchema` (zod enum) | `packages/schemas/src/platform-settings/index.ts` (NEW DIR) | additive |
| `SeoDefaultsValueSchema` | same dir | additive |
| `MaintenanceModeValueSchema` | same dir | additive |
| `AnnouncementsValueSchema` (array of `AnnouncementItemSchema`) | same dir | additive |
| `PlatformSettingsResponseSchema` (discriminated union by key) | same dir | additive |
| Export from package root | `packages/schemas/src/index.ts` | additive |

Critical: discriminated union keyed by `key` so admin form gets correct shape per setting type. Avoids `unknown` / `any` in the API contract.

### 2.3 Permissions (`packages/schemas/src/enums/permission.enum.ts`) — **D1 RESOLVED: create new permissions literal**

Per owner sign-off (D1=create-new), the following permissions will be ADDED to the enum and wired through role bundles + service-core checks:

| New permission | Replaces / scopes | Assigned to roles |
|----------------|-------------------|-------------------|
| `SETTINGS_GENERAL_VIEW` | finer-grained than `SETTINGS_MANAGE` (read-only) | ADMIN, SUPER_ADMIN |
| `SETTINGS_GENERAL_WRITE` | finer-grained write | ADMIN, SUPER_ADMIN |
| `MAINTENANCE_MODE_WRITE` | finer than `SYSTEM_MAINTENANCE_MODE` for write op only | SUPER_ADMIN |
| `BILLING_SETTINGS_VIEW` | finer-grained read on billing settings only | ADMIN, SUPER_ADMIN |
| `BILLING_SETTINGS_WRITE` | finer-grained write on billing settings only | ADMIN, SUPER_ADMIN |
| `BILLING_VIEW_OWN` | self-billing visibility for HOST (separate from ADMIN BILLING_READ_ALL) | HOST, ADMIN, SUPER_ADMIN |
| `SUBSCRIPTION_VIEW_OWN` | self-subscription visibility for HOST | HOST, ADMIN, SUPER_ADMIN |
| `USER_UPDATE_SELF` | self-profile update gate (vs USER_UPDATE_ANY) | ALL authenticated roles |

Files to touch:
- `packages/schemas/src/enums/permission.enum.ts` — add 8 enum entries with JSDoc.
- `packages/schemas/src/enums/__tests__/permission.enum.test.ts` — add assertions for new entries.
- `packages/schemas/src/permissions/role-permission-bundles.ts` (or wherever bundles live) — assign new perms to each role's bundle.
- `packages/schemas/src/permissions/__tests__/role-bundles.test.ts` — update fixtures + add assertions per role.
- `apps/api/src/middleware/billing-auth.ts` (or equiv) — wire `BILLING_VIEW_OWN` / `SUBSCRIPTION_VIEW_OWN` to the protected billing routes (or document why the existing ownership middleware still handles it and the new perms are just IA-surface labels).
- `apps/admin/src/config/ia/permission-bundles.ts` — update gating refs to use the new perm names where appropriate (per SPEC-154 config).

**Sanity check during impl**: confirm `BILLING_VIEW_OWN` granted to HOST does NOT accidentally widen access to ADMIN-only billing routes (e.g., `/admin/billing/*`). Those should keep gating on `BILLING_READ_ALL` / `BILLING_MANAGE` independently.

**Migration of existing checks**: `SETTINGS_MANAGE` and `SYSTEM_MAINTENANCE_MODE` are still kept in the enum (deprecation TBD) — V1 just ADDS finer-grained perms and uses them on new routes. Old routes can keep using existing perms; no breaking change in V1.

### 2.4 API (`apps/api/src/routes/`)

New routes:

| Route | File | Tier | Permission |
|-------|------|------|------------|
| `GET /api/v1/admin/platform-settings/:key` | `apps/api/src/routes/admin/platform-settings/index.ts` (NEW) | admin | `SETTINGS_MANAGE` (or `SYSTEM_MAINTENANCE_MODE` for critical key — discriminated by key param) |
| `PATCH /api/v1/admin/platform-settings/:key` | same file | admin | same |
| `GET /api/v1/public/announcements` | `apps/api/src/routes/public/announcements/index.ts` (NEW) | public | none — public read |

**Why a public announcements endpoint** (not in spec — gap discovered): web app today does NOT read announcements from anywhere (the localStorage in admin is per-browser-per-admin-user → invisible to public users). Without this endpoint the localStorage→API migration is half-done: SUPER_ADMIN can write, nobody can read on web. See **D2**.

Existing routes consumed by new admin pages (no changes):

| Route | Used by |
|-------|---------|
| `GET /api/v1/protected/billing/subscriptions?pageSize=1` | Mi facturación §1 |
| `GET /api/v1/protected/billing/invoices?pageSize=1&sort=date_desc` | Mi facturación §1 (latest invoice + PDF) |
| `GET /api/v1/protected/billing/usage` | Mi facturación §2 (the genuinely new piece of UI) |
| `POST /api/v1/admin/revalidation/revalidate/entity` | Auto-triggered after SEO PATCH (per D7) |

### 2.5 Service-core (`packages/service-core/`)

| Change | File | Type |
|--------|------|------|
| `PlatformSettingsService` extending `BaseCrudService` | `packages/service-core/src/services/platform-settings/platform-settings.service.ts` (NEW) | additive |
| Cache invalidation hook on SEO write | service `update()` override → enqueue revalidation for `/`, `/[lang]`, `/[lang]/posts` | additive |

Pattern: same as other services. `runWithLoggingAndValidation()`, `Result<T>` returns, permission check via `PermissionEnum`.

### 2.6 Admin app — Page relocations (`apps/admin/src/routes/_authed/`)

The 15+ relocations decomposed (each is one TanStack Start file move + redirect):

| Old path | New path | Strategy |
|----------|----------|----------|
| `me/profile.tsx` | `mi-cuenta/perfil.tsx` | move + redirect |
| `me/settings.tsx` | `mi-cuenta/preferencias.tsx` + `mi-cuenta/notificaciones.tsx` | **split** — extract notification block into separate file (B4 honest disclosure applies here) |
| `me/change-password.tsx` | `mi-cuenta/seguridad/cambiar-password.tsx` | move + redirect + create `mi-cuenta/seguridad/index.tsx` landing |
| `me/accommodations/*` | stays (linked from "Mis alojamientos" main item) | no move; update IA config sidebar ref |
| `me/tags.tsx` | `mi-cuenta/etiquetas.tsx` | move + redirect |
| `settings/critical.tsx` | `plataforma/critical.tsx` + localStorage→API rewrite | **rewrite** (data source changes) |
| `settings/seo.tsx` | `plataforma/configuracion/seo.tsx` + localStorage→API rewrite | **rewrite** |
| `revalidation/index.tsx` | `plataforma/cache/revalidacion/index.tsx` | move + redirect |
| `billing/cron.tsx` | `plataforma/ops/cron.tsx` | move + redirect |
| `billing/webhook-events.tsx` | `plataforma/ops/webhooks.tsx` | move + redirect |
| `billing/notification-logs.tsx` | `plataforma/email/logs.tsx` | move + redirect |
| `tags/internal/*` | `plataforma/tags/internas/*` | move dir + redirect |
| `tags/system/*` | `plataforma/tags/sistema/*` | move dir + redirect |
| `tags/post-tags/*` | stays + link from Editorial sidebar | no move; update IA config |
| `tags/user-moderation/*` | stays + link from Comunidad sidebar | no move; update IA config |
| `billing/settings.tsx` | stays in Comercial | no move; update IA config only |

**New pages (not from a move)**:
- `mi-cuenta/seguridad/index.tsx` — security landing with password change link + "(próximamente)" stubs
- `mi-cuenta/datos.tsx` — GDPR placeholder ("Próximamente")
- `me/facturacion.tsx` — Mi facturación HOST landing (see 2.7)
- `plataforma/critical/anuncios/index.tsx` — announcements editor list
- `plataforma/critical/anuncios/$id.edit.tsx` — announcement edit form
- `plataforma/critical/anuncios/new.tsx` — announcement create form

**Redirect strategy** — **D6 open**: TanStack Start supports `beforeLoad` redirects per route. Recommendation: create thin redirect files at OLD paths that throw `redirect({ to: NEW_PATH })`. Bookmark-friendly, server-evaluated, no client roundtrip.

### 2.7 Mi facturación HOST landing (`apps/admin/src/routes/_authed/mi-cuenta/facturacion.tsx`)

Single route file composes 3 section components:

| Component | Path | Data |
|-----------|------|------|
| `SubscriptionSummarySection` | `apps/admin/src/components/billing/host/SubscriptionSummarySection.tsx` (NEW) | Calls `GET /protected/billing/subscriptions?pageSize=1` + `GET /protected/billing/invoices?pageSize=1&sort=date_desc` (TanStack Query, parallel) |
| `PlanUsageSection` | `apps/admin/src/components/billing/host/PlanUsageSection.tsx` (NEW) | Calls `GET /protected/billing/usage`. Renders progress bars per resource. Thresholds: 80% warning, 95% danger, 100% blocked |
| `BillingActionsSection` | `apps/admin/src/components/billing/host/BillingActionsSection.tsx` (NEW) | Static actions: deep link to `${PUBLIC_WEB_URL}/${lang}/mi-cuenta/suscripcion`, link to `${PUBLIC_WEB_URL}/${lang}/suscriptores/planes`, "Descargar última factura" if invoice has `pdfUrl` |

**ProgressBar component reuse — D5 open**: SPEC-155 widget infra has `KpiWidget`, `ChartWidget`, etc., but no `ProgressBarWidget`. Three options:
- (a) Add `ProgressBarWidget` to SPEC-155 infrastructure (general reuse, more LOC, harder review).
- (b) Build standalone `<UsageProgressBar>` component inside billing/host/ (V1-scoped, simpler, no infra coupling).
- (c) Use raw `<progress>` HTML + Tailwind (minimal, but inconsistent with dashboards visual language).

**Recommendation R5**: option (b) — standalone for V1. If we later need progress bars elsewhere (dashboards, addons UI), promote to widget infra in a follow-up. YAGNI today.

**Permission gate**: route guarded by `beforeLoad` checking `BILLING_VIEW_OWN`-equivalent. Per D1 recommendation, use the existing protected billing middleware combo (no new permission). Concretely: gate by role having access to `/protected/billing/*` endpoints (HOST self-billing role per SPEC-164).

**Env requirement**: `PUBLIC_WEB_URL` must be available at admin client-side. Already exists per `packages/config/src/env-registry.*.ts` — verify it's exposed to admin app.

### 2.8 IA config (`apps/admin/src/config/ia/`) — SPEC-154 surface

This is where the SPEC-154 promise pays off: **a single config edit** describes the new IA. Files to touch:

- `sidebars.ts` — add `Plataforma` and `Comercial` sections with new sidebar items pointing to new routes; remove old refs.
- `roles/host.ts` — add `Mi facturación` main menu item + remove old `/mi-cuenta/facturacion` ghost refs.
- `roles/admin.ts`, `roles/super-admin.ts` — re-point to new `plataforma/*` routes.
- `sections.ts` — declare new sections if not present.
- `__tests__/*.test.ts` — update test fixtures; add new tests for `plataforma`, `comercial`, `mi-cuenta` shape.

No new types or new infrastructure — just data edits. Expected: ~200 LOC across configs + tests.

### 2.9 Web app (`apps/web/`)

Two changes:

1. **Announcements display** (per D2): if we add `GET /api/v1/public/announcements`, web needs a small Astro component to fetch + render the active announcement(s) in a layout slot. Variant + dismissible + start/end date filter client-side. ~80 LOC.
2. **SEO defaults consumption**: SSR layer reads from API instead of (today) hardcoded defaults / env. Already runs SSR — minor refactor in `apps/web/src/utils/seo.ts` (or wherever defaults live) to fetch from `/api/v1/public/platform-settings/seo.defaults` (would need to add a public endpoint, or admin reads + cache propagates via ISR tag).

**D7 open**: cache invalidation strategy for SEO defaults — see §3.

## 3. Cross-cutting concerns

### 3.1 localStorage→API migration helper

Three storage keys must migrate: `SEO_SETTINGS_KEY`, `MAINTENANCE_KEY`, `ANNOUNCEMENT_KEY`.

**D4 open** — three strategies:
- (a) **Client-side one-shot per browser**: on first admin load post-deploy, if localStorage has value AND server has no value, POST it to API. Set a flag cookie `_settings_migrated=true` to skip subsequent loads. Risk: if multiple admins migrate simultaneously, last-write-wins (acceptable — value is identical across browsers if not yet migrated).
- (b) **Idempotent on every load**: same check every time, no flag. Cheap (one GET) but adds a GET to every admin session forever.
- (c) **Server-side seed script**: zero client-side migration. Pre-deploy script reads from a hardcoded "default values" file, writes to DB. localStorage entries become dead. Cleaner but loses any custom values some admin set.

**Recommendation R4**: option (a) — pragmatic, low-risk, doesn't pollute steady-state with migration code forever. Add a removal task ~30 days post-deploy to delete the helper.

### 3.2 Cache invalidation on SEO write — **D7 open**

Today: revalidation is a manual UI button at `/revalidation`. SEO defaults change → admin must manually trigger revalidation for affected paths. That's bad UX, but it works.

Options:
- (a) **Auto-revalidate on PATCH**: `PlatformSettingsService.update()` for `seo.defaults` key calls `revalidationService.revalidateByEntityType('post')` + revalidate `/`. Pro: consistent. Con: couples settings to revalidation indirectly.
- (b) **ISR tag-based**: web SSR fetches SEO with `cache: 'force-cache'` + tag `seo-defaults`. PATCH endpoint calls `revalidateTag('seo-defaults')` (Astro/SSR equivalent). Pro: idiomatic. Con: needs verification that admin → web tag invalidation actually works cross-service.
- (c) **Manual only**: document the workflow in the SEO page UI ("After saving, revalidate at /plataforma/cache/revalidacion"). V1-scope correct, lowest risk. Con: still bad UX.

**Recommendation R7**: option (a) for V1. Option (b) is more correct but the cross-service tag invalidation testing scope is bigger than V1. Document the manual fallback in the page.

### 3.3 PR strategy — **D3 open**

~4 days of work, ~4,135 affected LOC, ~30-40 files net new/touched, 3 independent feature bundles. Mega-PR is reviewable hell.

Options:
- (a) **One mega-PR** to `staging`. Pro: atomic ship. Con: massive review, fragile rebase, blast radius.
- (b) **4 PRs**, in order:
  1. PR-1: DB migration + service + API endpoints + tests for `platform_settings`
  2. PR-2: page relocations + URL redirects + IA config update
  3. PR-3: localStorage→API migration (depends on PR-1)
  4. PR-4: Mi facturación HOST landing + announcements editor + honest disclosure labels
- (c) **2 PRs**: backend (PR-1+3) and frontend (PR-2+4).

**Recommendation R3**: option (b). Smaller diffs, parallel review, each PR independently revertible. PR-1 is foundational and unblocks PR-3+4.

### 3.4 Permission gate audit (AC-22..AC-26)

Per D1, ACs map to existing perms — no new perms. The audit task is: for each new route, verify the `beforeLoad` guard uses the mapped permission. Smoke per role (the dev test users from SPEC-143) confirms. No new infrastructure.

## 4. Risk register (additive to spec §7)

| Risk | New finding | Mitigation |
|------|-------------|------------|
| Permission ACs reference non-existent perms | D1 — naming mismatch | Map to existing perms in spec update; do NOT create new perms in V1 |
| Web app announcements display gap | D2 — no public endpoint today | Add `GET /api/v1/public/announcements` as part of B2 |
| Cache invalidation cross-service flakiness | D7 — admin PATCH→web SSR cache | Pick auto-revalidate (R7) + document fallback |
| URL redirect SEO cost | 301s preserve SEO juice; if missed, organic traffic to old paths 404s | Test every old path on staging before merge; add e2e test for redirects |
| `me/settings.tsx` split risks data loss for in-flight edits | 593 LOC file with shared form state | Land the split in PR-2 separately from data migration (PR-3); manual smoke for both new pages |
| Mi facturación deep links rot if web changes its URL | external coupling | Use single `PUBLIC_WEB_URL_PATH_SUBSCRIPTION` constant in admin; one-point change |

## 5. Resolved decisions

All 8 decisions resolved (2026-05-28). Recap:

| ID | Decision | Resolution | Source |
|----|----------|-----------|--------|
| **D1** | Permissions for ACs | **Create new permissions literal** (8 new entries: SETTINGS_GENERAL_VIEW/WRITE, MAINTENANCE_MODE_WRITE, BILLING_SETTINGS_VIEW/WRITE, BILLING_VIEW_OWN, SUBSCRIPTION_VIEW_OWN, USER_UPDATE_SELF). +4-5 tasks vs mapping. | owner sign-off (override of R1) |
| **D2** | Web announcements display | **Add `GET /api/v1/public/announcements` + Astro display component in web layout**. +2 tasks. | owner sign-off (= R2) |
| **D3** | PR strategy | **4 PRs in order**: PR-1 platform_settings infra → PR-2 page relocations + IA config → PR-3 localStorage migration helper → PR-4 Mi facturación + anuncios editor + honest disclosure. | owner sign-off (= R3) |
| **D4** | localStorage migration helper | **Per-browser one-shot with cookie flag `_settings_migrated=true` + scheduled cleanup task ~30 days post-deploy.** | default R4 applied |
| **D5** | Mi facturación usage progress bars | **Standalone `<UsageProgressBar>` component in `apps/admin/src/components/billing/host/`** — NOT added to SPEC-155 widget infra. Promote later if reused elsewhere (YAGNI). | default R5 applied |
| **D6** | URL redirect strategy | **TanStack Start `beforeLoad` redirects per old path** — thin file at each old route that throws `redirect({ to: NEW_PATH, permanent: true })`. | default R6 applied |
| **D7** | SEO cache invalidation | **Auto-revalidate on PATCH**: `PlatformSettingsService.update()` for `seo.defaults` key calls `revalidationService.revalidateByEntityType('post')` + revalidate `/`. Manual fallback documented in UI. | default R7 applied |
| **D8** | Mi facturación path | **`/mi-cuenta/facturacion`** — consistent with rest of Mi cuenta IA. Spec text references will be updated. | owner sign-off (= R8) |

### Spec follow-ups required

These updates should be reflected in spec.md before/during atomization:
- AC-7 path: `/me/facturacion` → `/mi-cuenta/facturacion` (D8).
- AC-22 to AC-26 permission names: replace with the new literal names from D1.
- §3 IN list: add "new public endpoint `GET /api/v1/public/announcements` + web display component" (D2).
- §3 IN list: add "8 new permission entries + role bundle updates" (D1).
- §6 task count: bump indicative estimate from 24-28 to 30-36.

## 6. Estimated task count by block

(Indicative — final atomization is `/task-master:task-from-spec` job.)

| Block | Approx tasks |
|-------|--------------|
| B1 page relocations + 301 redirects (TanStack beforeLoad) + IA config update | 10-12 |
| B2 platform_settings (DB + zod schemas + service + 2 admin endpoints + 1 public endpoint `/public/announcements` + per-browser localStorage migration helper + auto-revalidate-on-SEO-write wiring) | 9-10 |
| B3 Mi facturación HOST `/mi-cuenta/facturacion` (route + 3 sections + standalone `<UsageProgressBar>` + permission gate using new BILLING_VIEW_OWN/SUBSCRIPTION_VIEW_OWN + tests) | 6-7 |
| B4 anuncios editor + web display Astro component + honest disclosure + 8 new permission entries + role bundle updates + bundle tests | 8-10 |
| Quality gate per PR + per-role smoke (4 PRs) | 4 |
| **Total** | **37-43** |

(Spec §6 estimated 24-28. New total bumped by D1 resolution = create new perms literal: +4-5 tasks for enum + bundles + tests + middleware wiring; D2 web display: +2 tasks; per-PR quality gate split: +1.)

## 7. Out of scope (kept for reference)

Per spec §3 OUT + `99-future-enhancements.md`: 2FA, sessions, GDPR, OAuth UI, notification granularity, email infra UI, audit log, multi-banner announcements with audience targeting, HOST self-service write actions in admin.

Specifically OUT of this analysis: payment methods management (no backend endpoints today — needs separate spec), invoice history with pagination (deferred), add-ons UI (deferred), promo codes UI (deferred).

## 8. Next step

Decisions D1–D8 resolved. Ready for:

1. **Spec update**: apply the spec follow-ups from §5 to `spec.md` (path fix on AC-7, permission name updates AC-22..AC-26, scope additions).
2. **Atomize**: `/task-master:task-from-spec` to produce the ~37-43 atomic tasks across 4 PRs.
3. **Begin PR-1 (B2 foundation)**: DB migration → schemas → service → admin endpoints → public announcements endpoint → tests. Foundation for PR-3 (migration helper) and PR-4 (Mi facturación uses BILLING_VIEW_OWN gate created here).

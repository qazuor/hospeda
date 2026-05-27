---
specId: SPEC-155
title: Admin Dashboards V1 — Per-Role Widget Configuration
status: draft
complexity: high
owner: qazuor
created: 2026-05-22
revised: 2026-05-26
parent: (none)
related:
  - SPEC-154 (admin-config-driven-ia — REQUIRED dependency)
  - SPEC-153 (admin-design-tokens — visual styling for widgets)
  - SPEC-156 (admin-settings-reorganization — Mi facturación usage widget shares the same widget type)
  - SPEC-159 (cross-entity view tracking — phase 2, feeds HOST card G + EDITOR cards E/F)
  - SPEC-160 (newsletter open/click tracking — phase 2, feeds EDITOR card C open-rate)
  - SPEC-161 (cron run-history — phase 2, feeds ADMIN card D failed/last-run)
  - SPEC-162 (admin audit & security log query — phase 2, feeds SUPER card H)
  - SPEC-163 (Sentry error metrics — phase 2, feeds SUPER card H Sentry slot)
  - SPEC-164 (admin-billing-super-only — receives the ADMIN billing role-model change extracted from SPEC-155)
---

# SPEC-155 — Admin Dashboards V1

> **Status**: DRAFT — base scope captured 2026-05-22; **fully redefined 2026-05-26** in `.claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md`.

> **Authoritative source**: `03c-dashboards-redefinition.md` supersedes `03-dashboards.md` v0.3 for all per-role widget definitions, card counts, and backend scope decisions. Any disagreement between this spec and 03c resolves in favor of 03c.

> **Backend scope premise**: The original "V1 builds no new backend" premise was intentionally broken during the 2026-05-26 review. SPEC-155 now includes all 🟡 aggregations (new route, no DB change). 🔴 items (new infrastructure, new DB tables, or unresolved architectural decisions) are extracted to SPEC-159 through SPEC-163 and render as deferred placeholders within their host cards.

## 1. Origin

Phase 1 audit revealed the current admin dashboard shows **6 global KPI cards to everyone** regardless of role — HOST users see "10,000 accommodations" when they only have 3 of their own. Two main blocks ("Traffic Chart" + "Recent Activity") are placeholders. The dashboard misleads scoped users and carries no role-relevant information for non-admin roles.

Owner goal: replace the single global dashboard with **per-role dashboard configurations** where each role sees scoped, relevant data. SPEC-154 (config-driven IA) provides the infrastructure; SPEC-155 populates it with dashboard definitions and the supporting backend aggregations.

## 2. Goal

Deliver four per-role dashboard configurations (HOST, EDITOR, ADMIN base, SUPER_ADMIN extension) backed by:

- Widget rendering components plugged into the SPEC-154 config-driven infrastructure.
- New 🟡 aggregation routes (no DB schema changes) for data that exists but has no suitable endpoint.
- One targeted permission change (EDITOR newsletter grant).
- Additive extension of the SPEC-154 widget schema (`onMissing` field + `'checklist'` widget type) required by SPEC-155 dashboard configs.
- Deferred placeholders for 🔴 phase-2 data points, so every card renders correctly today and upgrades automatically when the phase-2 backend spec ships.

Success criteria: every role sees only data relevant to their scope; no global KPI leaks to HOST; existing 6 ADMIN KPIs pass parity; SUPER_ADMIN-only cards are hidden from ADMIN by config placement, not by a permission revoke (the revoke belongs to SPEC-164).

## 3. Scope

### Legend
- 🟢 backend ready — endpoint exists today.
- 🟡 backend ready, no DB change — data exists; new aggregation + route needed.
- 🔴 new backend — new infrastructure or unresolved architectural decision; deferred to phase-2 specs.

### IN — Dashboard configurations

**HOST dashboard — "Mi negocio" (7 cards)**

| Card | Summary | Backend |
|------|---------|:---:|
| A — Mis alojamientos | Own listings count + unpublished drafts list with publish link | 🟢 |
| B — Mi plan | Subscription status + next charge + plan usage (accommodations X/limit, warn ≥80%) | 🟢 |
| C — Consultas | Pending-inquiry KPI + top-5 list with per-item "Responder" action | 🟢 |
| D — Estado de mi alojamiento | "Mejorá tu alojamiento" completeness checklist (photos, description, amenities, price, location, contact); accommodation selector dropdown when host has >1 listing | 🟢 |
| E — Reseñas | Latest reviews received (read-only list) | 🟢 |
| F — Mi perfil | "Salud del perfil de host" — account + contact data completeness checklist | 🟢 |
| G — Estadísticas | Average rating + total reviews 🟢 · favorites per-accommodation breakdown 🟡 · response rate % + avg time 🟡 · views (deferred placeholder) 🔴→SPEC-159 | 🟢/🟡/🔴 |

**EDITOR dashboard — "La redacción" (8 cards)**

| Card | Summary | Backend |
|------|---------|:---:|
| A — Posts | Published this month + pending drafts count + recent drafts list | 🟢 |
| B — Eventos | Upcoming events count + list + featured upcoming list | 🟢 |
| C — Suscriptores Newsletter | Active subscribers + subscribers by content preference (OFFERS/EVENTS/GUIDES/PRODUCT_NEWS) 🟡; open rate deferred placeholder 🔴→SPEC-160 | 🟢/🟡/🔴 |
| D — Campañas Newsletter | Scheduled campaigns list | 🟢 |
| E — Estadísticas blog | Status distribution + most popular posts + total published + posts-per-month trend 🟡; views per post deferred placeholder 🔴→SPEC-159 | 🟢/🟡/🔴 |
| F — Estadísticas eventos | Total events + views per event deferred placeholder 🔴→SPEC-159 | 🟢/🔴 |
| G — Salud | Posts (missing image/tags/SEO) + events (missing image/location/organizer/description) — computed client-side | 🟢 |
| H — Comentarios | Recent comments on posts/events to moderate | 🟡 |

**ADMIN base dashboard (cards A–G, shared with SUPER_ADMIN)**

| Card | Summary | Backend |
|------|---------|:---:|
| A — Estadísticas de entidades | 6 content KPIs: accommodations, destinations, events, posts, attractions, users | 🟢 |
| B — Alojamientos | Latest published accommodations list | 🟢 |
| C — Editorial | Featured upcoming events + recent draft posts + draft events + posts this month | 🟢 |
| D — Crons | Cron job list + enabled/total count; failed/last-run deferred placeholder 🔴→SPEC-161 | 🟢/🔴 |
| E — Estado del sistema | Health (db/redis/api) + maintenance-mode status 🟡 | 🟢/🟡 |
| F — Pendiente de moderación | Unified pending-moderation count (4 entities) + reviews-pending count | 🟡 |
| G — Usuarios | Users by role count + new-users trend (date-grouped) | 🟡 |

**SUPER_ADMIN-only section (cards H–I, gated by `onMissing: 'hide'`)**

Cards H and I are placed exclusively in the `superAdminOnlySection` config. ADMIN does not see them because they are absent from `adminBaseDashboard` — this is pure **config placement gating**, not a permission revoke. ADMIN currently retains the 6 real billing permissions (`BILLING_READ_ALL`, `BILLING_MANAGE`, `MANAGE_SUBSCRIPTIONS`, `BILLING_PROMO_CODE_READ`, `BILLING_PROMO_CODE_MANAGE`, `BILLING_METRICS_READ`); removing them from ADMIN is a separate role-model change tracked in SPEC-164.

| Card | Summary | Backend |
|------|---------|:---:|
| H — Audit Logs | Admin actions audit log deferred 🔴→SPEC-162; security log deferred 🔴→SPEC-162; Sentry errors deferred 🔴→SPEC-163 | 🔴 |
| I — Estadísticas de billing | Active subscriptions + MRR + monthly revenue 12m chart + ARPU + churn + subscription breakdown. Gated to SUPER-only by `onMissing: 'hide'` in the config; no permission seed change required for the dashboard to be correct. | 🟢 |

### IN — 🟡 aggregation routes (new route, no DB change)

Each item below requires a new API route but no schema migration:

1. **HOST favorites per-accommodation**: protected route scoped to host — iterates host's listings, calls `countBookmarksForEntity()` per listing; returns `[{ accommodationId, slug, bookmarkCount }]`.
2. **HOST conversation response rate**: aggregation over `conversations` table fields `ownerMessageCount`, `firstGuestMessageAt`, `firstOwnerReplyAt` scoped to `ownerId={uid}` — returns `{ responseRatePct, avgResponseTimeMinutes }`.
3. **EDITOR subscribers by content preference**: aggregation over `newsletter_subscribers.preferences` JSONB for `status=active` — returns counts for OFFERS, EVENTS, GUIDES, PRODUCT_NEWS.
4. **EDITOR posts-per-month trend**: date-grouped count over `posts.createdAt` (last 12 months) — returns `[{ month: 'YYYY-MM', count }]`.
5. **EDITOR recent comments listing**: verify or build comment-listing endpoint (posts + events comments, sorted by `createdAt` desc, `pageSize=10`).
6. **ADMIN unified moderation-pending count**: single aggregator endpoint counting `moderationState=PENDING` across accommodations, destinations, posts, events — returns `{ total, byEntity: { accommodations, destinations, posts, events } }`.
7. **ADMIN reviews-pending count**: count endpoint for `reviews` with `moderationState=PENDING`.
8. **ADMIN users by role + new-users trend**: count-by-role aggregation + date-grouped `createdAt` aggregation (last 12 months) — returns `{ byRole: Record<Role, number>, newUsersTrend: [{ month, count }] }`.
9. **ADMIN/SUPER maintenance-mode readable flag**: confirm or expose `SYSTEM_MAINTENANCE_MODE` flag as a readable value (LOW-MEDIUM effort, no DB change expected).

> **Audit-log query endpoint — moved to SPEC-162 (NOT in 155).** 03c is internally inconsistent on this (🟡 in the card detail at line 258, 🔴 HIGH "DB change likely" in the planning table at line 275). The current audit infrastructure (`audit-logger.ts` / `AuditEventType`) is logger-only with no queryable store, so a query endpoint requires new backend → 🔴, deferred to SPEC-162. Card H therefore renders all three slots (audit log, security log, Sentry) as deferred placeholders until SPEC-162/163 ship.

### IN — Permission change (seed change on `packages/seed/src/required/rolePermissions.seed.ts`)

**GRANT to EDITOR**:
- `NEWSLETTER_CAMPAIGN_VIEW`
- `NEWSLETTER_CAMPAIGN_WRITE`
- `NEWSLETTER_SUBSCRIBER_VIEW`
- Do NOT grant `NEWSLETTER_CAMPAIGN_SEND` — sending stays admin-only ("editor drafts, admin sends").

> **ADMIN billing revoke is NOT in SPEC-155.** T-002 (the blast-radius audit, already completed) found that the spec-named permissions `BILLING_METRICS_VIEW` and `SUBSCRIPTION_VIEW_ALL` do not exist in `PermissionEnum`. The real ADMIN billing perm set is 6 entries (`BILLING_READ_ALL`, `BILLING_MANAGE`, `MANAGE_SUBSCRIPTIONS`, `BILLING_PROMO_CODE_READ`, `BILLING_PROMO_CODE_MANAGE`, `BILLING_METRICS_READ`). A clean revoke also requires changes to the SPEC-154 IA config and 14 admin billing page route guards — scope far beyond dashboards. This work is extracted to **SPEC-164 (admin-billing-super-only)**.

### IN — SPEC-154 schema extension (additive)

T-001 verification found two gaps in the SPEC-154 `WidgetSchema` that SPEC-155 requires:

1. **`onMissing` field on `WidgetSchema`**: `OnMissingSchema` exists for sidebar items but is not present on `WidgetSchema`. SPEC-155 needs `onMissing: 'hide'` to gate the SUPER-only cards (AC-4 / AC-5). Extension: add optional `onMissing` field to `WidgetSchema`, reusing `OnMissingSchema`, with default `'disable'`.
2. **`'checklist'` widget type**: `WidgetTypeSchema` currently accepts `kpi | list | chart | feed | callout | shortcut | map | calendar`. HOST cards D/F and EDITOR card G require a checklist renderer. Extension: add `'checklist'` to `WidgetTypeSchema`.
3. **Stub reconciliation**: the existing SPEC-154 stubs define `adminDashboard` and `superAdminDashboard` as separate top-level objects. SPEC-155 requires a `adminBaseDashboard` (cards A–G, shared) + `superAdminOnlySection` (cards H–I, `onMissing: 'hide'`) model. Reconcile the stubs to this structure as part of the dashboard config work.

These are **additive changes** to the SPEC-154 config schema — no existing configs are broken. The schema lives in `apps/admin/src/config/ia/schema.ts`. SPEC-154 is already merged; the extension ships within SPEC-155 as a follow-on commit to that file, coordinated with the SPEC-154 owner.

### IN — Computable checklists (client-side, no new endpoints)

- HOST card D: "Mejorá tu alojamiento" — checks loaded accommodation object for missing photos, description, amenities, price, exact location, contact info.
- HOST card F: "Salud del perfil de host" — checks loaded user/host object for account + contact data completeness.
- EDITOR card G: health checks for posts (missing featured image, missing tags, missing SEO metadata) and events (missing featured image, missing `locationId`, missing `organizerId`, missing extended `description`).

### IN — Dashboard infrastructure

- Dashboard configs in `apps/admin/src/config/ia/dashboards.ts` (depends on SPEC-154 schema).
- Widget renderer components in `apps/admin/src/components/dashboards/widgets/`.
- Data-source resolver registry `apps/admin/src/lib/dashboard-sources.ts` — maps source IDs to TanStack Query options.
- Deferred-placeholder renderer component for 🔴 widgets.
- Dashboard page renderer (`apps/admin/src/routes/_authed/dashboard.tsx`) consuming role's config.
- Auto-refresh on focus + manual "Actualizar" button; 60s `staleTime`.
- Migration: existing `useDashboardStats()` retired after parity verified for the 6 ADMIN KPIs.

### OUT of SPEC-155 (explicit exclusions)

- **SPEC-164** — ADMIN billing role-model change (admin-billing-super-only). T-002 audit found the spec-named permissions were fictional and that a clean revoke requires seed changes + SPEC-154 IA config edits (`roles/admin.ts` removing 'comercial', `sidebars.ts` `onMissing:'hide'`, re-gating billing routes) + 14 admin billing page route guards. The dashboard does not require this revoke: card I is config-gated to the SUPER-only section; ADMIN never sees it regardless of which permissions ADMIN holds. SPEC-164 owns the full role-model change.
- **SPEC-159** — cross-entity view tracking (accommodation views / post views / event views). Feeds HOST card G views slot + EDITOR cards E/F views slots. 🔴 Architectural decision pending (own DB table vs PostHog API). Those slots render a deferred placeholder until SPEC-159 ships.
- **SPEC-160** — newsletter open/click-rate tracking (email-open pixel). Feeds EDITOR card C open-rate slot. 🔴 Not stored today.
- **SPEC-161** — cron run-history storage (per-run result, new table). Feeds ADMIN card D failed/last-run slot. 🔴 Needs new DB table.
- **SPEC-162** — admin audit & security log query endpoints. Feeds SUPER card H audit + security slots. 🔴 Likely needs queryable store.
- **SPEC-163** — Sentry error metrics integration (Sentry API proxy). Feeds SUPER card H Sentry slot. 🔴 Sentry not queryable from our backend today.
- **SPONSOR + CLIENT_MANAGER dashboards** — roles remain `enabled: false`; no dashboard defined. Explicitly out of all V1 specs.
- "Events without a date" widget — dropped permanently. `EventDateSchema.start` is required; the widget is impossible.
- Top hosts by revenue widget — no revenue ordering in qzpay-hono (confirmed in 03b §11). Dropped.
- User-configurable widgets — per-role fixed configs in V1.
- Real-time push notifications for dashboard updates — post-V1.
- "Reviews unanswered" widget — reviews have no reply concept (confirmed in 03b §2). Dropped.
- Editorial calendar cross-content widget — needs aggregator endpoint, deferred post-V1.

## 4. Acceptance criteria

### A. SPEC-154 schema extension

- AC-1: `WidgetSchema` in `apps/admin/src/config/ia/schema.ts` accepts an optional `onMissing` field using `OnMissingSchema` (values: `'hide' | 'disable'`); default is `'disable'`. Existing configs that omit `onMissing` continue to pass Zod validation without change.
- AC-2: `WidgetTypeSchema` accepts `'checklist'` as a valid widget type in addition to the existing types.
- AC-3: The CI Zod schema validation suite (from SPEC-154) continues to pass after the schema extension is applied.

### B. Config validity

- AC-4: Four dashboard config objects exist: `hostDashboard` (7 cards), `editorDashboard` (8 cards), `adminBaseDashboard` (7 cards), `superAdminOnlySection` (2 cards). Card counts match 03c exactly.
- AC-5: Every card config passes the extended SPEC-154 Zod schema validation: unique `id`, valid `type`, tri-locale `label` (es/en/pt), valid `scope`.
- AC-6: Every `source` ID in every card maps to a registered entry in `dashboard-sources.ts`.
- AC-7: SUPER_ADMIN-only cards (H and I) are placed exclusively in `superAdminOnlySection` and are configured with `onMissing: 'hide'`.
- AC-8: ADMIN role resolves to `adminBaseDashboard` (7 cards). SUPER_ADMIN role resolves to `adminBaseDashboard` + `superAdminOnlySection` (9 cards total).

### C. Widget rendering

- AC-9: All widget type renderers are visually consistent (same skeleton loader, same padding, same card header style, same error callout).
- AC-10: KPI widgets display value + optional delta (up/down icon) + optional unit prefix/suffix.
- AC-11: List widgets display top-N items with optional `actionPerItem` rendered as button/link per item.
- AC-12: Chart widgets render line/bar/area per `config.chartType`.
- AC-13: Checklist widgets render dynamic items sourced from the loaded entity object with visual completeness indicator.
- AC-14: Deferred-placeholder renderer displays a "coming soon" visual for any 🔴 data slot, without erroring, without blocking other slots in the same card.
- AC-15: Empty states use `config.emptyState` (variant + i18n message). Loading shows skeleton. Error shows red callout with retry.

### D. Data sources and scoping

- AC-16: `resolveDataSource(sourceId, ctx)` maps every source ID in the config to an API call returning the documented shape.
- AC-17: HOST-scoped sources automatically inject `ownerId={currentUserId}` on every request. A HOST user's query results NEVER include data belonging to other owners.
- AC-18: Given: a HOST user with 2 accommodations. When: card D loads. Then: an accommodation selector dropdown is displayed and selecting each listing updates the checklist to that listing's data.
- AC-19: All TanStack queries use 60s `staleTime`, refetch-on-focus enabled, `queryKey` includes role and scope identifiers.

### E. 🟡 aggregation routes

For each item, the route exists in the API, is covered by an integration test, and returns the documented shape:

- AC-20: `GET /api/v1/protected/host/favorites/breakdown` returns `[{ accommodationId, slug, bookmarkCount }]` scoped to the authenticated host.
- AC-21: `GET /api/v1/protected/host/conversations/response-rate` returns `{ responseRatePct: number, avgResponseTimeMinutes: number }` scoped to the authenticated host.
- AC-22: `GET /api/v1/admin/newsletter/subscribers/by-preference` returns `{ OFFERS: number, EVENTS: number, GUIDES: number, PRODUCT_NEWS: number }` (requires `NEWSLETTER_SUBSCRIBER_VIEW`).
- AC-23: `GET /api/v1/admin/posts/trend` returns `[{ month: 'YYYY-MM', count: number }]` for the last 12 months.
- AC-24: A comment-listing endpoint exists (or is built) that returns recent comments across posts and events, sorted by `createdAt` desc; requires `POST_COMMENT_VIEW` and `EVENT_COMMENT_VIEW`.
- AC-25: `GET /api/v1/admin/moderation/pending-count` returns `{ total: number, byEntity: { accommodations, destinations, posts, events } }` (requires `MODERATION_REVIEW`).
- AC-26: `GET /api/v1/admin/reviews/pending-count` returns `{ count: number }` (requires `REVIEW_MODERATE`).
- AC-27: `GET /api/v1/admin/users/stats` returns `{ byRole: Record<string, number>, newUsersTrend: [{ month: string, count: number }] }` (requires `USER_VIEW_ALL`).
- AC-28: Maintenance-mode status is exposed as a readable value via an existing or new endpoint accessible with `SYSTEM_MAINTENANCE_MODE` permission.

### F. Permission change (EDITOR grant)

- AC-29: Given: a user with role EDITOR. When: they access the newsletter campaigns list. Then: they can view and create/edit draft campaigns; the "Send" action is not available to them.
- AC-30: Given: a user with role EDITOR. When: they access the newsletter subscribers list. Then: they can view the list.

### G. SUPER_ADMIN-only gating

- AC-31: Given: a user with role ADMIN. When: the dashboard renders. Then: cards H (Audit Logs) and I (Estadísticas de billing) are not visible — they are absent from `adminBaseDashboard` by config, not by permission check.
- AC-32: Given: a user with role SUPER_ADMIN. When: the dashboard renders. Then: cards A–I are all visible (base 7 + super 2 = 9).

### H. Refresh and performance

- AC-33: Global "Actualizar" button invalidates all dashboard queries for the current role.
- AC-34: All dashboard queries fire in parallel (no waterfall). Dashboard initial render completes in < 500ms on a warm cache.
- AC-35: Multiple cards querying the same underlying entity (e.g., ADMIN card A accommodations count + card B accommodations list) share a TanStack Query key prefix and do not make duplicate requests.

### I. Migration parity

- AC-36: Existing `apps/admin/src/routes/_authed/dashboard.tsx` is replaced by the new per-role renderer consuming each role's dashboard config.
- AC-37: The 6 existing ADMIN KPIs (accommodations, destinations, events, posts, attractions, users) return the same values under the new renderer as under the old `useDashboardStats()`.
- AC-38: `useDashboardStats()` hook is deleted after parity is confirmed.

## 5. Technical approach

1. **SPEC-154 schema extension first**: extend `WidgetSchema` with `onMissing` + add `'checklist'` to `WidgetTypeSchema` + reconcile stubs before any dashboard config or renderer work. This is the schema foundation everything else depends on.
2. **SPEC-154 dependency**: confirm `DashboardCardConfig`, section renderer, and the extended widget schema are available. SPEC-155 does not duplicate SPEC-154 internals.
3. **🟡 aggregation routes**: build and test each new API route in isolation before wiring the frontend. Each route is independently testable.
4. **Permission change**: the EDITOR newsletter grant is low-risk and can ship independently once T-013 verifies the permission names exist in `PermissionEnum`. No blast-radius concern.
5. **Widget renderers**: implement renderer components receiving `{ card: DashboardCardConfig, resolved: ResolvedData }`. Compose multi-slot cards (e.g., card G with 🟢 + deferred 🔴 slots) by rendering each slot independently.
6. **Deferred-placeholder component**: a single reusable `DeferredWidget` component that renders a "coming soon" visual for any 🔴 slot. Accepts a `phaseSpec` prop for display text.
7. **Source resolver registry**: `dashboard-sources.ts` maps source IDs to TanStack Query options (key factory + queryFn). Role context (userId, permissions) injected via React context — not prop-drilled.
8. **Dashboard configs**: populate `dashboards.ts` after renderers and resolver are in place. Config is pure data; validate against the extended SPEC-154 schema at CI time.
9. **Migration**: old dashboard page → new renderer. Run parity assertion against staging API for the 6 ADMIN KPIs before deleting `useDashboardStats()`.
10. **Tests**: unit per renderer, integration per aggregation route, config validation, scope isolation.

## 6. Task breakdown (atomic, complexity ≤ 4)

Grouped by phase. Phase ordering reflects dependency: schema extension before configs; backend before frontend; permission name verification before seed change.

### Phase 0 — Pre-work (blockers)

| # | Task | Complexity |
|---|------|:---:|
| T-001 | Confirm SPEC-154 exports: verify `DashboardCardConfig`, widget Zod schema, and section renderer are available; identify the two schema gaps (`onMissing` missing from `WidgetSchema`, `'checklist'` missing from `WidgetTypeSchema`) and the stub reconciliation needed — document findings to unblock T-002/T-003. **COMPLETED**: gaps confirmed, motivating Phase 0.5 tasks. | 1 |
| T-002 | **ADMIN billing blast-radius audit**: enumerate every admin billing route and page; verify the real billing PermissionEnum entries; produce written finding. **COMPLETED**: fictional perm names confirmed; 6 real perms identified; blast-radius scope extracted to SPEC-164. No seed change in SPEC-155. | 3 |

### Phase 0.5 — SPEC-154 schema extension (unblocks Phases 3–5)

| # | Task | Complexity |
|---|------|:---:|
| T-003 | Extend `WidgetSchema` in `apps/admin/src/config/ia/schema.ts`: add optional `onMissing` field reusing `OnMissingSchema` (default `'disable'`); add `'checklist'` to `WidgetTypeSchema`; update Zod tests to assert both additions are valid and existing configs are unaffected | 2 |
| T-004 | Reconcile `adminDashboard` / `superAdminDashboard` stubs in SPEC-154 into the `adminBaseDashboard` (cards A–G) + `superAdminOnlySection` (cards H–I, `onMissing: 'hide'`) model; update any existing stub references across `apps/admin/src/config/ia/` | 2 |

### Phase 1 — 🟡 Aggregation routes (backend)

| # | Task | Complexity |
|---|------|:---:|
| T-005 | `GET /api/v1/protected/host/favorites/breakdown` — per-accommodation bookmark count scoped to authenticated host (uses existing `countBookmarksForEntity()`) | 2 |
| T-006 | `GET /api/v1/protected/host/conversations/response-rate` — aggregate `ownerMessageCount`, `firstGuestMessageAt`, `firstOwnerReplyAt` scoped to `ownerId`; return `{ responseRatePct, avgResponseTimeMinutes }` | 3 |
| T-007 | `GET /api/v1/admin/newsletter/subscribers/by-preference` — aggregate `preferences` JSONB for active subscribers; return counts for OFFERS/EVENTS/GUIDES/PRODUCT_NEWS | 3 |
| T-008 | `GET /api/v1/admin/posts/trend` — date-grouped `createdAt` aggregation, last 12 months; return `[{ month, count }]` | 2 |
| T-009 | Recent-comments listing endpoint — verify `GET /api/v1/admin/comments` exists or build it (posts + events, `sort=created_at_desc`, `pageSize=10`) | 2 |
| T-010 | `GET /api/v1/admin/moderation/pending-count` — unified count across accommodations, destinations, posts, events where `moderationState=PENDING`; return `{ total, byEntity }` | 3 |
| T-011 | `GET /api/v1/admin/reviews/pending-count` — count reviews with `moderationState=PENDING`; return `{ count }` | 2 |
| T-012 | `GET /api/v1/admin/users/stats` — users by role + new-users trend (last 12 months date-grouped); return `{ byRole, newUsersTrend }` | 3 |
| T-013 | Maintenance-mode readable flag — confirm or build endpoint exposing `maintenanceMode` boolean (requires `SYSTEM_MAINTENANCE_MODE` permission) | 2 |
| T-014 | Integration tests for all 🟡 routes (T-005 through T-013) — one test file per route asserting shape, auth, and scope isolation | 4 |

### Phase 2 — Permission change (EDITOR grant)

| # | Task | Complexity |
|---|------|:---:|
| T-015 | Verify EDITOR newsletter grant — confirm `NEWSLETTER_CAMPAIGN_VIEW`, `NEWSLETTER_CAMPAIGN_WRITE`, `NEWSLETTER_SUBSCRIBER_VIEW` exist in `packages/schemas/src/enums/permission.enum.ts`; flag any missing name before proceeding (BLOCKS T-016) | 1 |
| T-016 | Seed change: add `NEWSLETTER_CAMPAIGN_VIEW` + `NEWSLETTER_CAMPAIGN_WRITE` + `NEWSLETTER_SUBSCRIBER_VIEW` to EDITOR role in `rolePermissions.seed.ts`; add test asserting EDITOR has these 3 and does NOT have `NEWSLETTER_CAMPAIGN_SEND` (BLOCKED by T-015) | 2 |

### Phase 3 — Frontend infrastructure

| # | Task | Complexity |
|---|------|:---:|
| T-017 | Source resolver registry: `apps/admin/src/lib/dashboard-sources.ts` — skeleton with role context provider, query key factory, typed resolver interface | 2 |
| T-018 | Source resolver: register all HOST 🟢 + 🟡 sources (cards A–G excluding views) | 3 |
| T-019 | Source resolver: register all EDITOR 🟢 + 🟡 sources (cards A–H excluding views/open-rate) | 3 |
| T-020 | Source resolver: register all ADMIN base 🟢 + 🟡 sources (cards A–G excluding cron run-history) | 3 |
| T-021 | Source resolver: register SUPER-only sources (card I billing; card H has no live source — all slots deferred) | 2 |
| T-022 | `DeferredWidget` component — reusable "coming soon" placeholder accepting `{ phaseSpec: string, description: string }`; renders without errors; visually consistent with other widgets | 2 |

### Phase 4 — Widget renderers

| # | Task | Complexity |
|---|------|:---:|
| T-023 | `KpiWidget` — value + optional delta + unit prefix/suffix | 2 |
| T-024 | `ListWidget` — top-N items + optional `actionPerItem` (button/link per item) | 2 |
| T-025 | `ChartWidget` — line/bar/area per `config.chartType` | 3 |
| T-026 | `ChecklistWidget` — dynamic items from loaded entity; completeness indicator + accommodation selector dropdown for HOST card D multi-listing behavior | 3 |
| T-027 | `StatusWidget` — health/badge cards (subscription status, system health, maintenance mode) | 2 |
| T-028 | Standardized loading skeleton, error callout (with retry), and empty state (uses `config.emptyState`) — shared across all widget types | 2 |

### Phase 5 — Dashboard configs

| # | Task | Complexity |
|---|------|:---:|
| T-029 | `hostDashboard` config — 7 cards (A–G) with source IDs, tri-locale labels, scope annotations | 3 |
| T-030 | `editorDashboard` config — 8 cards (A–H) with source IDs, tri-locale labels | 3 |
| T-031 | `adminBaseDashboard` config — 7 cards (A–G) with source IDs, tri-locale labels | 3 |
| T-032 | `superAdminOnlySection` config — 2 cards (H–I) with `onMissing: 'hide'` | 2 |
| T-033 | CI config validation test — vitest suite asserting all 4 configs pass the extended SPEC-154 Zod schema and card counts match spec (HOST=7, EDITOR=8, ADMIN-base=7, SUPER-only=2) | 2 |

### Phase 6 — Dashboard renderer and migration

| # | Task | Complexity |
|---|------|:---:|
| T-034 | Dashboard renderer component — reads role's resolved config(s), fires all source queries in parallel, dispatches to widget type renderers; includes "Actualizar" button (invalidates `['dashboard', role]`) | 3 |
| T-035 | Dashboard page migration — replace `apps/admin/src/routes/_authed/dashboard.tsx` to consume the per-role renderer; keep old `useDashboardStats()` path active until parity confirmed | 2 |
| T-036 | Parity verification — integration test asserting the 6 ADMIN KPI values from the new renderer match the old `useDashboardStats()` on a seeded DB (BLOCKS T-037) | 3 |
| T-037 | Delete `useDashboardStats()` after T-036 passes; confirm no other consumer references it | 1 |

### Phase 7 — Tests and hardening

| # | Task | Complexity |
|---|------|:---:|
| T-038 | HOST scope isolation tests — assert `ownerId` injected on all HOST-scoped queries; assert no global count leaks when two HOST users have different accommodations | 3 |
| T-039 | SUPER gating tests — assert ADMIN sees 7 cards; assert SUPER_ADMIN sees 9 cards; assert `onMissing: 'hide'` hides super section for ADMIN | 2 |
| T-040 | Performance baseline — assert all dashboard queries fire in parallel (no waterfall); assert initial render < 500ms on warm cache | 2 |
| T-041 | Deferred-placeholder rendering tests — assert each 🔴 slot renders `DeferredWidget` without errors; assert remaining 🟢/🟡 slots in the same card are unaffected | 2 |

**Total estimated tasks**: 41 (T-001..T-041). Two tasks completed (T-001, T-002); two new tasks added for Phase 0.5 schema extension; two billing-revoke tasks removed (old T-015/T-016). Average complexity ~2.4.

**Hard-gate dependencies**:
- T-003 and T-004 (schema extension) BLOCK Phases 3–5 (config validation requires the extended schema).
- T-015 (permission name verification) BLOCKS T-016 (seed change).
- T-036 (parity verification) BLOCKS T-037 (delete old hook).

## 7. Risks

| Risk | Likelihood | Mitigation |
|------|:---:|------|
| Permission names not in PermissionEnum — T-002 already found that the spec-named billing perms (`BILLING_METRICS_VIEW`, `SUBSCRIPTION_VIEW_ALL`) do not exist. The same could apply to EDITOR newsletter perms. | Medium | T-015 explicitly verifies every permission name against `packages/schemas/src/enums/permission.enum.ts` before the seed change (T-016) runs. Any missing name is flagged and the seed change is blocked until resolved. |
| HOST ownerId leak — aggregation routes accidentally return global counts instead of host-scoped | Medium | T-038 scope isolation tests explicitly assert per-user data boundaries. Each 🟡 HOST route receives `ownerId` from auth context, not from query params. |
| 🟡 aggregation route shape mismatch — newly built endpoint returns a different structure than the dashboard source resolver expects | Medium | Each 🟡 route has a defined return shape in §4 ACs. T-014 integration tests verify shape before frontend wires it. |
| SPEC-154 schema extension breaks existing configs — adding `onMissing` and `'checklist'` could accidentally invalidate configs that omit `onMissing` | Low-Medium | `onMissing` is optional with a default — no existing config is required to add it. T-003 includes a regression test asserting existing configs still pass. |
| Deferred placeholder UX — partial cards (some slots live, some deferred) may confuse users if not clearly communicated | Low-Medium | `DeferredWidget` uses unambiguous "coming soon" language + links to what SPEC will unlock it. Design reviewed before T-035. |
| Dashboard query waterfall — 7–9 parallel queries may create perceived latency | Low | TanStack Query parallel firing + warm cache target < 500ms (T-040). Add Suspense boundaries per card to prevent whole-dashboard block. |
| Config validation drift — dashboard configs pass type-check but fail at runtime due to Zod schema mismatch | Low | T-033 CI validation suite catches this on every PR. |

## 8. Rollback plan

- **Pre-merge**: full per-role visual review + integration tests green + parity confirmed (T-036).
- **Post-merge — dashboard renderer**: revert `dashboard.tsx` to restore old `useDashboardStats()` path (single file change).
- **Post-merge — EDITOR permission grant**: revert the seed change commit and re-run seed. T-015 name-verification reduces the probability of needing this.
- **Post-merge — schema extension**: the `onMissing` field is optional and `'checklist'` is additive — reverting means removing both additions from `schema.ts` and dropping the checklist renderer. Any config using `onMissing: 'hide'` would need fallback handling.
- **Widget-by-widget**: any card can be removed from a dashboard config by editing `dashboards.ts` and deploying — no backend change required.
- **🔴 placeholder cards**: these never break — they render `DeferredWidget` regardless of backend state.

## 9. Dependencies

- **REQUIRED**: SPEC-154 (admin-config-driven-ia) — provides the dashboard config schema, widget schema, and section renderer. SPEC-155 extends the schema additively (T-003/T-004) and cannot ship without SPEC-154 in production.
- **Optional but recommended**: SPEC-153 (design tokens) — widgets use brand tokens for visual consistency, but SPEC-155 can ship before full token migration.
- **Extracted**: SPEC-164 (admin-billing-super-only) — receives the ADMIN billing role-model change (seed revoke of the 6 real billing perms + SPEC-154 IA config edits + 14 billing page route guards). SPEC-155 does not depend on SPEC-164 shipping; card I is config-gated today.
- **Phase-2 widget enablers** (SPEC-155 ships without them; their cards render deferred placeholders):
  - SPEC-159 (cross-entity view tracking) — enables HOST card G views + EDITOR cards E/F views.
  - SPEC-160 (newsletter open/click tracking) — enables EDITOR card C open-rate.
  - SPEC-161 (cron run-history) — enables ADMIN card D failed/last-run.
  - SPEC-162 (admin audit & security log query) — enables SUPER card H audit + security.
  - SPEC-163 (Sentry error metrics) — enables SUPER card H Sentry errors.

## 10. References

- `.claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md` (**authoritative** — supersedes 03 v0.3 for all card/widget definitions and backend scope decisions).
- `.claude/audit/admin-redesign/proposals/03-dashboards.md` (v0.3) — original widget configs; preserved for endpoint-verification history.
- `.claude/audit/admin-redesign/proposals/03b-endpoint-verification.md` (v0.1) — verified endpoint paths + filters per role.
- `.claude/audit/admin-redesign/proposals/02-config-schema.md` (v0.2+ §7) — widget Zod schema (SPEC-154 owns this).
- `.claude/audit/admin-redesign/phase-1/05-dashboard-settings.md` — current dashboard audit (pre-redesign baseline).
- `apps/admin/src/features/dashboard/*` — current dashboard implementation to be migrated.
- `packages/seed/src/required/rolePermissions.seed.ts` — permission seed file for both permission changes.
- `packages/schemas/src/enums/permission.enum.ts` — permission enum definitions.

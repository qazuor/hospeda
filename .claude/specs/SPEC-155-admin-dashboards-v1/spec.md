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
- Two targeted permission changes (EDITOR newsletter grant + ADMIN billing revoke).
- Deferred placeholders for 🔴 phase-2 data points, so every card renders correctly today and upgrades automatically when the phase-2 backend spec ships.

Success criteria: every role sees only data relevant to their scope; no global KPI leaks to HOST; existing 6 ADMIN KPIs pass parity; permission model accurately reflects who owns billing data.

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

| Card | Summary | Backend |
|------|---------|:---:|
| H — Audit Logs | Admin actions audit log deferred 🔴→SPEC-162; security log deferred 🔴→SPEC-162; Sentry errors deferred 🔴→SPEC-163 | 🔴 |
| I — Estadísticas de billing | Active subscriptions + MRR + monthly revenue 12m chart + ARPU + churn + subscription breakdown | 🟢 |

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

### IN — Permission changes (seed changes on `packages/seed/src/required/rolePermissions.seed.ts`)

**Change 1 — GRANT to EDITOR**:
- `NEWSLETTER_CAMPAIGN_VIEW`
- `NEWSLETTER_CAMPAIGN_WRITE`
- `NEWSLETTER_SUBSCRIBER_VIEW`
- Do NOT grant `NEWSLETTER_CAMPAIGN_SEND` — sending stays admin-only ("editor drafts, admin sends").

**Change 2 — REVOKE from ADMIN**:
- `BILLING_METRICS_VIEW`
- `SUBSCRIPTION_VIEW_ALL`
- Billing ownership becomes SUPER_ADMIN-only.
- ⚠️ **Wide blast radius**: revoking these permissions removes ADMIN from the WHOLE billing section of the panel, not just the dashboard card. Before the seed change ships, every admin billing route and page must be audited to confirm none hard-assumes ADMIN access (ADMIN-Q2 from 03c). This audit is a blocker task.

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

### A. Config validity

- AC-1: Four dashboard config objects exist: `hostDashboard` (7 cards), `editorDashboard` (8 cards), `adminBaseDashboard` (7 cards), `superAdminOnlySection` (2 cards). Card counts match 03c exactly.
- AC-2: Every card config passes SPEC-154 Zod schema validation: unique `id`, valid `type`, tri-locale `label` (es/en/pt), valid `scope`.
- AC-3: Every `source` ID in every card maps to a registered entry in `dashboard-sources.ts`.
- AC-4: SUPER_ADMIN-only cards (H and I) are gated with `onMissing: 'hide'` and the appropriate permission check (`AUDIT_LOG_VIEW` for H, `BILLING_METRICS_VIEW` for I).
- AC-5: ADMIN role resolves to `adminBaseDashboard` (7 cards). SUPER_ADMIN role resolves to `adminBaseDashboard` + `superAdminOnlySection` (9 cards total).

### B. Widget rendering

- AC-6: All widget type renderers are visually consistent (same skeleton loader, same padding, same card header style, same error callout).
- AC-7: KPI widgets display value + optional delta (up/down icon) + optional unit prefix/suffix.
- AC-8: List widgets display top-N items with optional `actionPerItem` rendered as button/link per item.
- AC-9: Chart widgets render line/bar/area per `config.chartType`.
- AC-10: Checklist widgets render dynamic items sourced from the loaded entity object with visual completeness indicator.
- AC-11: Deferred-placeholder renderer displays a "coming soon" visual for any 🔴 data slot, without erroring, without blocking other slots in the same card.
- AC-12: Empty states use `config.emptyState` (variant + i18n message). Loading shows skeleton. Error shows red callout with retry.

### C. Data sources and scoping

- AC-13: `resolveDataSource(sourceId, ctx)` maps every source ID in the config to an API call returning the documented shape.
- AC-14: HOST-scoped sources automatically inject `ownerId={currentUserId}` on every request. A HOST user's query results NEVER include data belonging to other owners.
- AC-15: Given: a HOST user with 2 accommodations. When: card D loads. Then: an accommodation selector dropdown is displayed and selecting each listing updates the checklist to that listing's data.
- AC-16: All TanStack queries use 60s `staleTime`, refetch-on-focus enabled, `queryKey` includes role and scope identifiers.

### D. 🟡 aggregation routes

For each item, the route exists in the API, is covered by an integration test, and returns the documented shape:

- AC-17: `GET /api/v1/protected/host/favorites/breakdown` returns `[{ accommodationId, slug, bookmarkCount }]` scoped to the authenticated host.
- AC-18: `GET /api/v1/protected/host/conversations/response-rate` returns `{ responseRatePct: number, avgResponseTimeMinutes: number }` scoped to the authenticated host.
- AC-19: `GET /api/v1/admin/newsletter/subscribers/by-preference` returns `{ OFFERS: number, EVENTS: number, GUIDES: number, PRODUCT_NEWS: number }` (requires `NEWSLETTER_SUBSCRIBER_VIEW`).
- AC-20: `GET /api/v1/admin/posts/trend` returns `[{ month: 'YYYY-MM', count: number }]` for the last 12 months.
- AC-21: A comment-listing endpoint exists (or is built) that returns recent comments across posts and events, sorted by `createdAt` desc; requires `POST_COMMENT_VIEW` and `EVENT_COMMENT_VIEW`.
- AC-22: `GET /api/v1/admin/moderation/pending-count` returns `{ total: number, byEntity: { accommodations, destinations, posts, events } }` (requires `MODERATION_REVIEW`).
- AC-23: `GET /api/v1/admin/reviews/pending-count` returns `{ count: number }` (requires `REVIEW_MODERATE`).
- AC-24: `GET /api/v1/admin/users/stats` returns `{ byRole: Record<string, number>, newUsersTrend: [{ month: string, count: number }] }` (requires `USER_VIEW_ALL`).
- AC-25: Maintenance-mode status is exposed as a readable value via an existing or new endpoint accessible with `SYSTEM_MAINTENANCE_MODE` permission.

### E. Permission changes

- AC-26: Given: a user with role EDITOR. When: they access the newsletter campaigns list. Then: they can view and create/edit draft campaigns; the "Send" action is not available to them.
- AC-27: Given: a user with role EDITOR. When: they access the newsletter subscribers list. Then: they can view the list.
- AC-28: Given: a user with role ADMIN (not SUPER_ADMIN). When: they attempt to access any billing route (metrics, subscriptions, plans). Then: they receive a 403 response.
- AC-29: Given: a user with role ADMIN. When: the admin billing section renders. Then: no page errors or 500s occur — the section gracefully reflects the permission removal.
- AC-30: Given: a user with role SUPER_ADMIN. When: they access billing metrics. Then: access is granted and data loads correctly.

### F. SUPER_ADMIN-only gating

- AC-31: Given: a user with role ADMIN. When: the dashboard renders. Then: cards H (Audit Logs) and I (Estadísticas de billing) are not visible.
- AC-32: Given: a user with role SUPER_ADMIN. When: the dashboard renders. Then: cards A–I are all visible (base 7 + super 2 = 9).

### G. Refresh and performance

- AC-33: Global "Actualizar" button invalidates all dashboard queries for the current role.
- AC-34: All dashboard queries fire in parallel (no waterfall). Dashboard initial render completes in < 500ms on a warm cache.
- AC-35: Multiple cards querying the same underlying entity (e.g., ADMIN card A accommodations count + card B accommodations list) share a TanStack Query key prefix and do not make duplicate requests.

### H. Migration parity

- AC-36: Existing `apps/admin/src/routes/_authed/dashboard.tsx` is replaced by the new per-role renderer consuming each role's dashboard config.
- AC-37: The 6 existing ADMIN KPIs (accommodations, destinations, events, posts, attractions, users) return the same values under the new renderer as under the old `useDashboardStats()`.
- AC-38: `useDashboardStats()` hook is deleted after parity is confirmed.

## 5. Technical approach

1. **SPEC-154 dependency**: Confirm widget schema (`DashboardCardConfig`, `WidgetConfig`, section renderer) is available. SPEC-155 does not duplicate it.
2. **🟡 aggregation routes first**: build and test each new API route in isolation before wiring the frontend. Each route is independently testable.
3. **Permission changes**: the ADMIN billing revoke requires a dedicated blast-radius audit task that BLOCKS the seed change commit. The EDITOR newsletter grant is low-risk and can ship independently.
4. **Widget renderers**: implement the renderer components receiving `{ card: DashboardCardConfig, resolved: ResolvedData }`. Compose multi-slot cards (e.g., card G with 🟢 + deferred 🔴 slots) by rendering each slot independently.
5. **Deferred-placeholder component**: a single reusable `DeferredWidget` component that renders a "coming soon" visual for any 🔴 slot. Accepts a `phaseSpec` prop for display text.
6. **Source resolver registry**: `dashboard-sources.ts` maps source IDs to TanStack Query options (key factory + queryFn). Role context (userId, permissions) injected via React context — not prop-drilled.
7. **Dashboard configs**: populate `dashboards.ts` after renderers and resolver are in place. Config is pure data; validate against SPEC-154 schema at CI time.
8. **Migration**: old dashboard page → new renderer. Run parity assertion against staging API for the 6 ADMIN KPIs before deleting `useDashboardStats()`.
9. **Tests**: unit per renderer, integration per aggregation route, config validation, scope isolation.

## 6. Task breakdown (atomic, complexity ≤ 4)

Grouped by phase. Phase ordering reflects dependency: backend before frontend; blast-radius audit before seed change.

### Phase 0 — Pre-work (blockers)

| # | Task | Complexity |
|---|------|:---:|
| T-001 | Confirm SPEC-154 exports: verify `DashboardCardConfig`, widget Zod schema, section renderer, and `onMissing: 'hide'` gating are available and match what SPEC-155 needs | 1 |
| T-002 | **ADMIN billing blast-radius audit**: enumerate every admin billing route and page; confirm none hard-checks for ADMIN role instead of `BILLING_METRICS_VIEW` / `SUBSCRIPTION_VIEW_ALL`; produce written finding (BLOCKS T-015) | 3 |

### Phase 1 — 🟡 Aggregation routes (backend)

| # | Task | Complexity |
|---|------|:---:|
| T-003 | `GET /api/v1/protected/host/favorites/breakdown` — per-accommodation bookmark count scoped to authenticated host (uses existing `countBookmarksForEntity()`) | 2 |
| T-004 | `GET /api/v1/protected/host/conversations/response-rate` — aggregate `ownerMessageCount`, `firstGuestMessageAt`, `firstOwnerReplyAt` scoped to `ownerId`; return `{ responseRatePct, avgResponseTimeMinutes }` | 3 |
| T-005 | `GET /api/v1/admin/newsletter/subscribers/by-preference` — aggregate `preferences` JSONB for active subscribers; return counts for OFFERS/EVENTS/GUIDES/PRODUCT_NEWS | 3 |
| T-006 | `GET /api/v1/admin/posts/trend` — date-grouped `createdAt` aggregation, last 12 months; return `[{ month, count }]` | 2 |
| T-007 | Recent-comments listing endpoint — verify `GET /api/v1/admin/comments` exists or build it (posts + events, `sort=created_at_desc`, `pageSize=10`) | 2 |
| T-008 | `GET /api/v1/admin/moderation/pending-count` — unified count across accommodations, destinations, posts, events where `moderationState=PENDING`; return `{ total, byEntity }` | 3 |
| T-009 | `GET /api/v1/admin/reviews/pending-count` — count reviews with `moderationState=PENDING`; return `{ count }` | 2 |
| T-010 | `GET /api/v1/admin/users/stats` — users by role + new-users trend (last 12 months date-grouped); return `{ byRole, newUsersTrend }` | 3 |
| T-011 | Maintenance-mode readable flag — confirm or build endpoint exposing `maintenanceMode` boolean (requires `SYSTEM_MAINTENANCE_MODE` permission) | 2 |
| T-012 | Integration tests for all 🟡 routes (T-003 through T-011) — one test file per route asserting shape, auth, and scope isolation | 4 |

### Phase 2 — Permission changes

| # | Task | Complexity |
|---|------|:---:|
| T-013 | Verify EDITOR newsletter grant — confirm `NEWSLETTER_CAMPAIGN_VIEW`, `NEWSLETTER_CAMPAIGN_WRITE`, `NEWSLETTER_SUBSCRIBER_VIEW` are defined in `packages/schemas/src/enums/permission.enum.ts` | 1 |
| T-014 | Seed change: add `NEWSLETTER_CAMPAIGN_VIEW` + `NEWSLETTER_CAMPAIGN_WRITE` + `NEWSLETTER_SUBSCRIBER_VIEW` to EDITOR role in `rolePermissions.seed.ts`; add test asserting EDITOR has these 3 and does NOT have `NEWSLETTER_CAMPAIGN_SEND` | 2 |
| T-015 | Seed change: revoke `BILLING_METRICS_VIEW` + `SUBSCRIPTION_VIEW_ALL` from ADMIN role in `rolePermissions.seed.ts` (BLOCKED by T-002 blast-radius audit passing); add tests asserting ADMIN lacks both and SUPER_ADMIN retains them | 3 |
| T-016 | Verify admin billing UI graceful degradation — after T-015, test that admin billing pages return 403 cleanly with no 500s or unhandled errors | 2 |

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
| T-032 | `superAdminOnlySection` config — 2 cards (H–I) with `onMissing: 'hide'` permission gates | 2 |
| T-033 | CI config validation test — vitest suite asserting all 4 configs pass SPEC-154 Zod schema and card counts match spec (HOST=7, EDITOR=8, ADMIN-base=7, SUPER-only=2) | 2 |

### Phase 6 — Dashboard renderer and migration

| # | Task | Complexity |
|---|------|:---:|
| T-034 | Dashboard renderer component — reads role's resolved config(s), fires all source queries in parallel, dispatches to widget type renderers; includes "Actualizar" button (invalidates `['dashboard', role]`) | 3 |
| T-035 | Dashboard page migration — replace `apps/admin/src/routes/_authed/dashboard.tsx` to consume the per-role renderer; keep old `useDashboardStats()` path active until parity confirmed | 2 |
| T-036 | Parity verification — integration test asserting the 6 ADMIN KPI values from the new renderer match the old `useDashboardStats()` on a seeded DB | 3 |
| T-037 | Delete `useDashboardStats()` after T-036 passes; confirm no other consumer references it | 1 |

### Phase 7 — Tests and hardening

| # | Task | Complexity |
|---|------|:---:|
| T-038 | HOST scope isolation tests — assert `ownerId` injected on all HOST-scoped queries; assert no global count leaks when two HOST users have different accommodations | 3 |
| T-039 | SUPER gating tests — assert ADMIN sees 7 cards; assert SUPER_ADMIN sees 9 cards; assert toggling permission renders/hides super section correctly | 2 |
| T-040 | Performance baseline — assert all dashboard queries fire in parallel (no waterfall); assert initial render < 500ms on warm cache | 2 |
| T-041 | Deferred-placeholder rendering tests — assert each 🔴 slot renders `DeferredWidget` without errors; assert remaining 🟢/🟡 slots in the same card are unaffected | 2 |

**Total estimated tasks**: 41. Average complexity ~2.4.

## 7. Risks

| Risk | Likelihood | Mitigation |
|------|:---:|------|
| ADMIN billing revoke blast radius — existing admin billing pages 500 or behave unexpectedly after `BILLING_METRICS_VIEW` + `SUBSCRIPTION_VIEW_ALL` are removed from ADMIN | High | T-002 explicit blast-radius audit task BLOCKS T-015 seed change. T-016 verifies graceful degradation post-change. |
| HOST ownerId leak — aggregation routes accidentally return global counts instead of host-scoped | Medium | T-039 scope isolation tests explicitly assert per-user data boundaries. Each 🟡 HOST route receives `ownerId` from auth context, not from query params. |
| 🟡 aggregation route shape mismatch — newly built endpoint returns a different structure than the dashboard source resolver expects | Medium | Each 🟡 route has a defined return shape in §4 ACs. T-013 integration tests verify shape before frontend wires it. |
| SPEC-154 schema gap — `onMissing: 'hide'` gating or multi-slot card config may not be expressible in the current SPEC-154 schema | Medium | T-001 pre-work task confirms SPEC-154 exports match SPEC-155 needs before any implementation starts. If gap found, coordinate with SPEC-154 owner to extend schema. |
| Deferred placeholder UX — partial cards (some slots live, some deferred) may confuse users if not clearly communicated | Low-Medium | `DeferredWidget` uses unambiguous "coming soon" language + links to what SPEC will unlock it. Design reviewed before T-035. |
| Dashboard query waterfall — 7–9 parallel queries may create perceived latency | Low | TanStack Query parallel firing + warm cache target < 500ms (T-041). Add Suspense boundaries per card to prevent whole-dashboard block. |
| Config validation drift — dashboard configs pass type-check but fail at runtime due to Zod schema mismatch | Low | T-034 CI validation suite catches this on every PR. |

## 8. Rollback plan

- **Pre-merge**: full per-role visual review + integration tests green + parity confirmed (T-037).
- **Post-merge — dashboard renderer**: revert `dashboard.tsx` to restore old `useDashboardStats()` path (single file change).
- **Post-merge — permission changes**: revert the seed change commit and re-run seed. Blast-radius audit (T-002) and graceful degradation test (T-017) reduce the probability of needing this.
- **Widget-by-widget**: any card can be removed from a dashboard config by editing `dashboards.ts` and deploying — no backend change required.
- **🔴 placeholder cards**: these never break — they render `DeferredWidget` regardless of backend state.

## 9. Dependencies

- **REQUIRED**: SPEC-154 (admin-config-driven-ia) — provides the dashboard config schema, widget schema, section renderer, and `onMissing: 'hide'` permission gating. SPEC-155 cannot ship without SPEC-154 in production.
- **Optional but recommended**: SPEC-153 (design tokens) — widgets use brand tokens for visual consistency, but SPEC-155 can ship before full token migration.
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

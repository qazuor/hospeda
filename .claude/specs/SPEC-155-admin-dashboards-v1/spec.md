---
specId: SPEC-155
title: Admin Dashboards V1 — Per-Role Widget Configuration
status: draft
complexity: medium
owner: qazuor
created: 2026-05-22
parent: (none)
related:
  - SPEC-154 (admin-config-driven-ia — REQUIRED dependency)
  - SPEC-153 (admin-design-tokens — visual styling for widgets)
  - SPEC-156 (admin-settings-reorganization — Mi facturación usage widget shares the same widget type)
---

# SPEC-155 — Admin Dashboards V1

> **Status**: DRAFT — base scope captured during the admin redesign planning session 2026-05-22. Widget configs locked in `.claude/audit/admin-redesign/proposals/03-dashboards.md` (v0.3+) after endpoint verification (`03b-endpoint-verification.md`).

## 1. Origin

Phase 1 audit revealed the current admin dashboard shows **6 global KPI cards to everyone** regardless of role — HOST users see "10,000 accommodations" when they only have 3 of their own. Two main blocks ("Traffic Chart" + "Recent Activity") are placeholders marked "Coming Soon" for months. The dashboard misleads scoped users.

Owner's goal: per-role dashboards with **scoped data** (HOST sees their own, ADMIN sees platform). All widgets must consume EXISTING endpoints — V1 does not build new backend.

## 2. Goal

Build per-role dashboard configurations + widget rendering components. HOST gets 6 scoped widgets, EDITOR 8, ADMIN/SUPER_ADMIN 10 (shared `adminDashboard` config). Every widget verified against existing API endpoints per `03b-endpoint-verification.md`.

## 3. Scope

### IN
- Dashboard configs in `apps/admin/src/config/ia/dashboards.ts` (depends on SPEC-154 schema).
- 3 dashboard configs:
  - `hostDashboard`: 6 widgets (3 KPIs + 1 action list + 2 subscription widgets).
  - `editorDashboard`: 8 widgets (5 KPIs + 3 action lists).
  - `adminDashboard`: 10 widgets (6 existing global KPIs + 3 billing widgets + 1 upcoming events list). Shared by ADMIN + SUPER_ADMIN.
- 8 widget types per schema §7: `kpi`, `list`, `chart`, `feed`, `callout`, `shortcut`, `map`, `calendar`.
- Widget renderer components in `apps/admin/src/components/dashboards/widgets/`:
  - `KpiWidget`, `ListWidget`, `ChartWidget`, `FeedWidget`, `CalloutWidget`, `ShortcutWidget`, `MapWidget`, `CalendarWidget`.
- Data source resolver registry `apps/admin/src/lib/dashboard-sources.ts` mapping `source` IDs to API calls (per doc 03 §6 table).
- Empty / loading / error states standardized (doc 03 §8).
- Auto-refresh on focus + manual "Actualizar" button at dashboard top.
- 60s staleTime for queries.
- Permission scoping logic — `scope: 'own' | 'all' | 'toggle'` per widget per doc 03 §1.2.
- Dashboard page renderer (`apps/admin/src/routes/_authed/dashboard.tsx` or `/inicio.tsx`) consuming role's dashboard config.

### OUT
- Editorial calendar cross-content widget (needs aggregator endpoint — deferred to post-V1 per doc 03 Open Q-B).
- Top hosts by revenue widget (no ordering by revenue in qzpay-hono per `03b §11` — dropped from V1).
- Reviews "unanswered" widgets (reviews have no reply concept per `03b §2` — dropped from V1).
- Sentry errors / failed crons / audit log preview super-only widgets (no backing code — moved to `99-future-enhancements.md`).
- Real-time push notifications for dashboard updates (post-V1).
- User-configurable widgets (per-role fixed in V1 per IA doc §6 / Decisions log).

## 4. Acceptance criteria

### A. Configs
- AC-1: 3 dashboard configs defined matching doc 03 §2-§5 widget arrays.
- AC-2: Each widget config passes the schema §7 validation (id unique, type valid, label tri-locale, scope valid).
- AC-3: All `source` IDs match the verified registry in doc 03 §6 (post-verification — no 🟡 flags remain).
- AC-4: SUPER_ADMIN dashboard config = `adminDashboard` (shared) per IA doc §16 and `01 Decisions log`.

### B. Widget rendering
- AC-5: 8 widget type renderers implemented and visually consistent (same skeleton, same padding, same header style).
- AC-6: KPI widgets show value + optional delta (with up/down icon) + optional unit prefix/suffix.
- AC-7: List widgets show top-N items with optional `actionPerItem` rendering as button/link per item.
- AC-8: Chart widgets render line/bar/area per `config.chartType`.
- AC-9: Callout widgets render with `variantWhen` mapping (active/expiring/expired → different colors).
- AC-10: Calendar widget shows date-based items in the configured `range` days.
- AC-11: Empty states use `config.emptyState` (variant + i18n message). Loading shows skeleton. Error shows red callout with retry.

### C. Data sources
- AC-12: `resolveDataSource(sourceId, ctx)` maps every source ID listed in doc 03 §6 to its endpoint call.
- AC-13: User-scoped sources (`source.own.*`) automatically inject `ownerId={currentUserId}` filter.
- AC-14: All queries respect TanStack Query patterns: stale time 60s, refetch on focus enabled, queryKey includes role + scope.

### D. Refresh + perf
- AC-15: Global "Actualizar" button invalidates all queries with `queryKey: ['dashboard', role]`.
- AC-16: Queries cache deduped via TanStack Query factory pattern (no N+1 with multiple KPIs hitting the same entity endpoint — e.g., accommodations count + accommodation list use the same query key prefix).
- AC-17: Dashboard initial render < 500ms on a warm cache (no waterfall — all queries fire in parallel).

### E. Per-role visibility
- AC-18: HOST sees only `hostDashboard` widgets (6 total). KPI values scoped to their accommodations.
- AC-19: EDITOR sees only `editorDashboard` widgets (8 total). Newsletter open rate KPI fetches last campaign metrics correctly.
- AC-20: ADMIN and SUPER_ADMIN see `adminDashboard` (same widget config, 10 visible) — V1 has zero super-only widgets per doc 03 §5.

### F. Migration
- AC-21: Existing `apps/admin/src/routes/_authed/dashboard.tsx` migrates to consume the role's dashboard config.
- AC-22: `useDashboardStats()` hook deprecated — replaced by per-widget source resolver. No regression in count values for ADMIN (the 6 existing global KPIs continue working).

## 5. Technical approach

1. **Widget types** — implement the 8 widget renderer components first. Each is a focused component receiving `{ widget: Widget, resolved: ResolvedData }`.
2. **Source resolver** — `dashboard-sources.ts` maps source IDs to TanStack Query options (queryKey + queryFn). Per-role context (userId, permissions) injected via React context.
3. **Dashboard renderer** — single page that reads role's dashboard config + iterates widgets, dispatching to type renderers.
4. **Configs** — populate `dashboards.ts` with the 3 dashboard objects.
5. **Migration** — old dashboard → new renderer. Delete `useDashboardStats()` after verifying parity.
6. **Tests** — per widget type, per dashboard config, per scope mode.

## 6. Task breakdown (atomic, complexity ≤ 4)

Estimated 26-30 tasks.

Indicative breakdown:
- Widget renderers (8 components): 8 tasks
- Source resolver registry: 3 tasks (skeleton, per-entity sources, scoping context)
- Dashboard renderer + layout: 2 tasks
- Configs (3 dashboards): 3 tasks
- Empty/loading/error standardization: 2 tasks
- Refresh + auto-refresh wiring: 1 task
- Migration of existing dashboard: 2 tasks (parity check + cutover)
- Tests: 5-7 tasks

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Endpoints flagged 🟡 in earlier audit may have additional surprises not caught | Implementation runs each source resolver against staging API early — fail fast, drop widgets that don't return expected shape. |
| HOST scoping logic regression — could leak global counts to HOST | Test each `source.own.*` resolver asserting ownerId is passed. Add integration tests with multiple users. |
| Dashboard performance with 10 simultaneous queries (ADMIN/SUPER_ADMIN) | TanStack Query handles parallel queries fine. Add slow-network testing. Consider stale-while-revalidate strategy. |
| Widget config drift from schema (TS types vs Zod) | Run validation in CI for the dashboard config. Schema in SPEC-154 enforces shape. |
| Newsletter campaign metrics endpoint shape uncertainty | Verified in `03b §15-16` — last campaign open-rate accessible via `?status=sent&pageSize=1&sort=sent_at_desc`. Implementation confirms during task. |

## 8. Rollback plan

- Pre-merge: full visual review per role + integration tests.
- Post-merge: revert the dashboard renderer cutover — old `useDashboardStats` re-enabled by reverting one route file.
- Widget-by-widget rollback: each widget config can be removed by editing `dashboards.ts` and pushing.

## 9. Dependencies

- **REQUIRED**: SPEC-154 (admin-config-driven-ia) — provides the dashboard config schema, widget schema, and the section renderer that hosts dashboards.
- **Optional but recommended**: SPEC-153 (design tokens) — dashboards look nicer with brand tokens, but can ship before tokens migrate.

## 10. References

- `.claude/audit/admin-redesign/proposals/03-dashboards.md` (v0.3+) — widget configs per role + data sources reference.
- `.claude/audit/admin-redesign/proposals/03b-endpoint-verification.md` (v0.1) — endpoint verification with corrected paths + filters.
- `.claude/audit/admin-redesign/proposals/02-config-schema.md` (v0.2+ §7) — widget Zod schema.
- `.claude/audit/admin-redesign/phase-1/05-dashboard-settings.md` (current dashboard audit).
- `apps/admin/src/features/dashboard/*` (current dashboard implementation).

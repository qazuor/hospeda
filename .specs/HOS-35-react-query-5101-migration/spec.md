---
title: Migrate @tanstack/react-query 5.59 → 5.101 (admin dashboard loading-state regression)
linear: HOS-35
statusSource: linear
created: 2026-07-01
type: chore
areas:
  - admin
  - devops
---

# SPEC-322: Migrate @tanstack/react-query 5.59 → 5.101

> Migrated from `.qtm/specs/SPEC-322-react-query-5101-migration/spec.md` on 2026-07-01 as part of the Linear tracking migration. Canonical tracking is now HOS-35.

## 1. Context

The Dependabot prod minor/patch group (PR #1959, 65 bumps) tried to move
`@tanstack/react-query` from `5.59.20` to `5.101.1` (42 minor releases). This
version jump **breaks the admin dashboard widgets**: they stay stuck in their
loading skeleton state instead of rendering data.

Isolated during the June-2026 Dependabot triage:

- With react-query `5.101.1`: `ListWidget.test.tsx` fails 12 / 32 (the widget
  renders skeleton placeholders, `screen.getAllByTestId('list-item')` finds
  nothing). Failures span the whole widget suite — `ChecklistWidget`,
  `StatusWidget`, `resolver-widget-integration`, `KpiWidget`, `ChartWidget`,
  `DashboardRenderer`.
- With react-query pinned back to `5.59.20`: all **270** dashboard tests pass.

The symptom (widgets stuck on the loading skeleton) points at a change in how
`useQuery` resolves its loading/pending state between 5.59 and 5.101. It is
**not yet confirmed whether this is only test-harness brittleness or a real
production regression** (dashboards stuck loading for real users). That
uncertainty is exactly why the bump was deferred instead of force-fixed inside
the 65-bump group.

### What already exists (do NOT redo)

- `@tanstack/react-query` is **gated** in `.github/dependabot.yml` (PR #1960),
  so Dependabot will not re-open this bump until the ignore entry is lifted.
- The prod group (#1959) shipped every other bump (including the react/react-dom
  19.2.7 unification) with react-query kept at `5.59.20`.
- The admin app uses TanStack Query for all server state (`apps/admin`); mobile
  also depends on it (`apps/mobile`, currently `5.59.20`).

## 2. Goal

Move `@tanstack/react-query` to `5.101.1` (or the latest stable 5.x at
implementation time) with the admin dashboard verified to render correctly —
both in tests and against a running admin app — then lift the Dependabot gate.

## 3. Out of scope

- Other `@tanstack/*` packages (react-table, react-virtual, etc. bump fine on
  their own; `@tanstack/react-router` is separately gated for SPEC-045).
- A TanStack Query v6 migration (this is a 5.x minor jump only).
- Any dashboard feature/UX change beyond restoring correct loading/data states.

## 4. Technical design

### 4.1 Root-cause the loading-state change

Diff the relevant `@tanstack/react-query` changelog entries between 5.59 and
5.101. Prime suspects:

- Changes to `isPending` / `isLoading` / `isFetching` / `status` semantics.
- Changes to how a synchronously-available/mocked query result surfaces on first
  render (the widget tests mock the query client / query result and assert the
  data state immediately).
- Stricter default `staleTime` / suspense / `pending` handling.

Determine whether the widgets (`apps/admin/src/components/dashboards/**`) read a
query flag that changed meaning, or whether the widget **tests** need to flush /
await differently under 5.101.

### 4.2 Fix widgets and/or tests

- If it is a real behavior change: update the widgets' loading/data-state logic
  so they render data under 5.101 (production fix).
- If it is test-harness only: update the shared widget test setup (mock query
  client / render helpers) so the mocked query resolves as the widgets expect.

Cover every failing file: `ListWidget`, `ChecklistWidget`, `StatusWidget`,
`resolver-widget-integration`, `KpiWidget`, `ChartWidget`, `DashboardRenderer`
(and any others that surface once 5.101 is reinstalled).

### 4.3 Bump + lift the gate

- Set `@tanstack/react-query` to the target `5.101.x` in `apps/admin/package.json`
  and `apps/mobile/package.json`, relock.
- Remove the `- dependency-name: '@tanstack/react-query'` ignore entry and its
  comment block from `.github/dependabot.yml`.

## 5. Tasks

### WS-1 — Root-cause

- T-1 Reproduce the widget failures on 5.101 locally; capture the exact query
  flag / render timing that differs from 5.59.
- T-2 Classify: real production regression vs test-harness brittleness. Document
  the finding in this spec.

### WS-2 — Fix

- T-3 Apply the fix (widget code and/or shared test setup) so all dashboard
  widget tests pass under 5.101.
- T-4 If a production behavior change: manually verify the admin dashboards
  render data (not stuck on skeleton) against a running admin app.

### WS-3 — Bump + ungate

- T-5 Bump react-query to the target 5.101.x in admin + mobile, relock.
- T-6 Remove the react-query ignore entry from `.github/dependabot.yml`.

### WS-4 — Verify

- T-7 Full admin unit suite green; targeted dashboard run green.
- T-8 PR to `staging` with `[SPEC-322]` title; CI green.

## 6. Testing strategy

- Unit: the existing admin dashboard widget suites are the regression gate —
  all must pass under 5.101 (270+ tests).
- Manual: load the admin dashboards (staff + owner variants) against a running
  admin app and confirm widgets render data, error, and empty states correctly.

## 7. Dependencies

- None blocking. Independent of other specs. The gate PR (#1960) must be merged
  first (it is, or will be) so the bump is a deliberate act, not a Dependabot
  auto-reopen.

## 8. Risks

- **Real dashboard regression**: if 5.101 genuinely changed loading semantics,
  the fix touches production dashboard code, not just tests. Verify against a
  live admin app before merging (do not rely on tests alone).
- **Scope creep**: resist bundling other TanStack bumps or dashboard rework into
  this migration. Keep it to react-query + the widgets it breaks.

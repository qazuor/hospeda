# HOS-39: Plans, Limits & Entitlements Editable Without Deploy

## Progress: 0/10 active tasks (0%) — 13 tasks cancelled (already shipped via SPEC-168/192/211)

> **spec-realign (2026-07-02) found major drift**: most of the original 23-task plan was already
> implemented before this spec was picked up. See spec.md's Revision History for full detail.
> A live bug was also discovered (Model C `'capability'` fields are editable via admin UI but
> silently reverted by seed sync) — **awaiting owner decision before continuing**, see spec.md.

**Average Complexity (active tasks):** 2.5/3 (max)
**Parallel Tracks:** 2 identified (schema migration T-001..T-005; test/docs/cleanup T-019..T-023)

---

### Cancelled (already shipped — SPEC-168/192/211)

- [x] ~~T-006~~ PlanService DB-backed read methods — already exists
- [x] ~~T-007~~ Admin edit-attributes mutation w/ atomic price write — already implemented
- [x] ~~T-008~~ Admin edit-limit-values mutation — already implemented
- [x] ~~T-009~~ addon-entitlement limit-value DB lookup — already implemented
- [x] ~~T-010~~ Admin plans list endpoint reads DB — already implemented
- [x] ~~T-011~~ Public listPlans endpoint reads DB — already implemented
- [x] ~~T-012~~ Drop ALL_PLANS fallback in admin plans table — already no fallback
- [x] ~~T-013~~ Owner pricing page SSG→SSR — already SSR
- [x] ~~T-014~~ Tourist pricing page SSG→SSR — already SSR
- [x] ~~T-015~~ Admin edit-attributes UI — already exists (PlanDialog.tsx)
- [x] ~~T-016~~ Admin edit-limits UI — already exists (PlanDialog.tsx)
- [x] ~~T-017~~ Wire Cloudflare revalidation trigger — already wired on every mutation
- [x] ~~T-018~~ TanStack Query invalidation — already part of shipped admin UI

### Setup/Core Phase (still valid — typed-column migration)

- [ ] **T-001** (complexity: 3) - Add typed plan-attribute columns to qzpay-drizzle schema
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-002** (complexity: 1) - Bump qzpay-drizzle pin and install in Hospeda
  - Blocked by: T-001
  - Blocks: T-003

- [ ] **T-003** (complexity: 3) - Write migration promoting metadata fields to typed columns
  - Blocked by: T-002
  - Blocks: T-004

- [ ] **T-004** (complexity: 2) - Repoint MODEL_C_FIELD_SPLIT at new typed columns
  - Blocked by: T-003
  - Blocks: T-005

- [ ] **T-005** (complexity: 3) - Update seed sync to read/write typed plan-attribute columns
  - Blocked by: T-004
  - Blocks: none

### Testing Phase (scope revised — verify EXISTING behavior)

- [ ] **T-019** (complexity: 3) - Integration test: admin attribute edit reflects live without deploy
  - Blocked by: none (target functionality already shipped)
  - Blocks: T-022, T-023

- [ ] **T-020** (complexity: 3) - Integration test: limit-value edit reflects at checkout without deploy
  - Blocked by: none
  - Blocks: T-022

- [ ] **T-021** (complexity: 3) - Integration test: web pricing page reflects DB change post-revalidation
  - Blocked by: none
  - Blocks: T-022

### Docs Phase

- [ ] **T-022** (complexity: 2) - Document the narrowed Model C admin-editable field policy
  - Blocked by: T-019, T-020, T-021
  - Blocks: none

### Cleanup Phase (scope expanded)

- [ ] **T-023** (complexity: 2) - Audit and prune now-dead ALL_PLANS display-surface references
  - Scope expanded to also cover: `qzpay-admin-hooks.ts`, `payment-logic.ts` (MP webhook), `apply-scheduled-plan-changes.ts` (cron)
  - Blocked by: T-019
  - Blocks: none

---

## Pending Decision (blocks meaningful next steps)

A live production bug was found: `entitlements`/`sortOrder`/`hasTrial`/`trialDays` are editable via
the admin `PlanDialog.tsx` today, but `MODEL_C_FIELD_SPLIT` classifies them `'capability'` (config
wins) — meaning any such admin edit is silently reverted by the next seed sync / deploy. No task
covers fixing this yet. See spec.md Revision History for full detail; owner decision needed on
which direction to fix it before adding a task for it.

## Suggested Start

**T-001** and **T-019** can both start immediately (no blockers) — but consider resolving the
live-bug decision above first, since it may reshape scope more than the remaining 10 tasks.

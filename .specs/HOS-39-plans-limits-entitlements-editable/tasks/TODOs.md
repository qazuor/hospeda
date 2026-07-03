# HOS-39: Plans, Limits & Entitlements Editable Without Deploy

## Progress: 4/14 active tasks (29%) — 13 tasks cancelled (already shipped via SPEC-168/192/211)

> **spec-realign (2026-07-02) found major drift**: most of the original 23-task plan was already
> implemented before this spec was picked up. See spec.md's Revision History for full detail.
> **Live Model-C bug FIXED (2026-07-02)**: entitlements/sortOrder/hasTrial/trialDays reclassified
> to commercial (T-024/T-025), category/isDefault removed from the editable surface (T-026), and
> a runtime guard added to PlanService.update() so this bug class cannot recur (T-027). All 4
> commits: `3be3eb9fd`, `3bed21dad`, `6bc5914d1`.

**Average Complexity (active, remaining):** 2.9/3 (max)
**Remaining work:** typed-column migration (T-001..T-005) + verification tests/docs/cleanup (T-019..T-023)

---

### Completed

- [x] **T-024** — Reclassify entitlements/sortOrder/hasTrial/trialDays to commercial in Model C
- [x] **T-025** — Stop seed sync from overwriting the 4 reclassified fields
- [x] **T-026** — Remove category/isDefault from UpdatePlanInput (+ disable in PlanDialog edit mode)
- [x] **T-027** — Add runtime Model C guard to PlanService.update()

### Cancelled (already shipped — SPEC-168/192/211)

T-006 through T-018 (13 tasks) — see spec.md Revision History.

### Setup/Core Phase — typed-column migration (still valid, not started)

- [ ] **T-001** (complexity: 3) - Add typed plan-attribute columns to qzpay-drizzle schema
  - Blocked by: none | Blocks: T-002
- [ ] **T-002** (complexity: 1) - Bump qzpay-drizzle pin and install in Hospeda
  - Blocked by: T-001 | Blocks: T-003
- [ ] **T-003** (complexity: 3) - Write migration promoting metadata fields to typed columns
  - Blocked by: T-002 | Blocks: T-004
- [ ] **T-004** (complexity: 2) - Repoint MODEL_C_FIELD_SPLIT at new typed columns
  - Blocked by: T-003 | Blocks: T-005
- [ ] **T-005** (complexity: 3) - Update seed sync to read/write typed plan-attribute columns
  - Blocked by: T-004 | Blocks: none

### Testing Phase (scope revised — verify EXISTING behavior, not started)

- [ ] **T-019** (complexity: 3) - Integration test: admin attribute edit reflects live without deploy
  - Blocked by: none | Blocks: T-022, T-023
- [ ] **T-020** (complexity: 3) - Integration test: limit-value edit reflects at checkout without deploy
  - Blocked by: none | Blocks: T-022
- [ ] **T-021** (complexity: 3) - Integration test: web pricing page reflects DB change post-revalidation
  - Blocked by: none | Blocks: T-022

### Docs Phase

- [ ] **T-022** (complexity: 2) - Document the narrowed Model C admin-editable field policy + the bugfix
  - Blocked by: T-019, T-020, T-021 (T-027 dependency now satisfied) | Blocks: none

### Cleanup Phase (scope expanded, not started)

- [ ] **T-023** (complexity: 2) - Audit and prune now-dead ALL_PLANS display-surface references
  - Scope expanded to also cover: `qzpay-admin-hooks.ts`, `payment-logic.ts` (MP webhook), `apply-scheduled-plan-changes.ts` (cron)
  - Blocked by: T-019 | Blocks: none

---

## Suggested Next

Available now (no blockers): **T-001** (typed-column migration, cross-repo), **T-019**, **T-020**,
**T-021** (verification tests). The migration chain (T-001→T-005) and the test/docs/cleanup group
are independent tracks — either can go first.

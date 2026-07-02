# HOS-39: Plans, Limits & Entitlements Editable Without Deploy

## Progress: 0/14 active tasks (0%) — 13 tasks cancelled (already shipped via SPEC-168/192/211)

> **spec-realign (2026-07-02) found major drift**: most of the original 23-task plan was already
> implemented before this spec was picked up. See spec.md's Revision History for full detail.
> A live bug was also found and a fix decided: Model C misclassified `entitlements`/`sortOrder`/
> `hasTrial`/`trialDays` as config-only while the admin UI already let operators edit them,
> causing silent reverts on every seed sync. Fix = reclassify those 4 fields to commercial
> (T-024/T-025), remove `category`/`isDefault` from the editable surface since nobody asked for
> them (T-026), and add a runtime guard so this class of bug can't recur (T-027).

**Average Complexity (active tasks):** 2.5/3 (max)
**Parallel Tracks:** 3 identified (typed-column migration T-001..T-005; Model-C bugfix T-024..T-027; test/docs/cleanup T-019..T-023)

---

### Cancelled (already shipped — SPEC-168/192/211)

T-006 through T-018 (13 tasks) — see spec.md Revision History for the full list and evidence per task.

### Setup/Core Phase — typed-column migration (still valid)

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

### Core Phase — live Model-C bug fix (new, 2026-07-02)

- [ ] **T-024** (complexity: 2) - Reclassify entitlements/sortOrder/hasTrial/trialDays to commercial in Model C
  - Blocked by: none | Blocks: T-025, T-027
- [ ] **T-025** (complexity: 3) - Stop seed sync from overwriting the 4 reclassified fields
  - Blocked by: T-024 | Blocks: none
- [ ] **T-026** (complexity: 2) - Remove category/isDefault from UpdatePlanInput
  - Blocked by: none | Blocks: T-027
- [ ] **T-027** (complexity: 3) - Add runtime Model C guard to PlanService.update()
  - Blocked by: T-024, T-026 | Blocks: T-022

### Testing Phase (scope revised — verify EXISTING behavior)

- [ ] **T-019** (complexity: 3) - Integration test: admin attribute edit reflects live without deploy
  - Blocked by: none | Blocks: T-022, T-023
- [ ] **T-020** (complexity: 3) - Integration test: limit-value edit reflects at checkout without deploy
  - Blocked by: none | Blocks: T-022
- [ ] **T-021** (complexity: 3) - Integration test: web pricing page reflects DB change post-revalidation
  - Blocked by: none | Blocks: T-022

### Docs Phase

- [ ] **T-022** (complexity: 2) - Document the narrowed Model C admin-editable field policy + the bugfix
  - Blocked by: T-019, T-020, T-021, T-027 | Blocks: none

### Cleanup Phase (scope expanded)

- [ ] **T-023** (complexity: 2) - Audit and prune now-dead ALL_PLANS display-surface references
  - Scope expanded to also cover: `qzpay-admin-hooks.ts`, `payment-logic.ts` (MP webhook), `apply-scheduled-plan-changes.ts` (cron)
  - Blocked by: T-019 | Blocks: none

---

## Suggested Start

Four tasks have no dependencies and can start in parallel right now:

- **T-001** — typed-column migration (cross-repo, longest chain, start first)
- **T-024** — Model-C reclassification (the live-bug fix, no dependencies, high value)
- **T-026** — remove category/isDefault from UpdatePlanInput (no dependencies)
- **T-019** — integration test for already-shipped attribute-edit behavior

Recommended: **T-024** first — it's the live production bug, small (complexity 2), and unblocks
both T-025 and (with T-026) T-027, the two other bugfix tasks.

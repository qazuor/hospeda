# SPEC-211: AI Monetization Model

## Progress: 12/17 tasks (71%) — setup + core + the Model C migration (T-011 linchpin, real-DB tested T-012) DONE; remaining: T-013 chat tests, T-014 search route, T-015 addon tests, T-016/T-017 docs

**Average Complexity:** 2.2/3 (max)
**Critical Path:** T-001 → T-003 → T-008 → T-010 → T-011 → T-013 → T-016 → T-017 (8 steps)
**Parallel Tracks:** 4 tracks identified

---

### Setup Phase

- [x] **T-001** (complexity: 1) - Replace -1 AI quotas with finite values in plans.config.ts
  - Replace every `-1` AI limit in `packages/billing/src/config/plans.config.ts` with §6.1 finite values
  - Blocked by: none
  - Blocks: T-003, T-008, T-011

- [x] **T-002** (complexity: 2) - Set concrete USD cost ceilings in ai_settings config (+ runtime fallback + seed)
  - Set globalMonthlyMicroUsd + perFeatureMonthlyMicroUsd in AiCostCeilingsSchema config
  - Blocked by: none
  - Blocks: T-012

- [x] **T-003** (complexity: 1) - Remove ai_chat and MAX_AI_CHAT_PER_MONTH from tourist plans in config
  - Remove AI_CHAT entitlement and limit key from tourist-free, tourist-plus, tourist-vip
  - Blocked by: T-001
  - Blocks: T-008, T-011

- [x] **T-004** (complexity: 1) - Remove ai_search and MAX_AI_SEARCH_PER_MONTH from all plans in config
  - Remove AI_SEARCH and MAX_AI_SEARCH_PER_MONTH from all 9 plans in plans.config.ts
  - Blocked by: none
  - Blocks: T-008, T-011

- [x] **T-005** (complexity: 2) - Add ai_support recurring addon definition to addons.config.ts
  - Add AI_SUPPORT_ADDON to addons.config.ts with recurring billing, AI_SUPPORT grant, finite quota
  - Blocked by: none
  - Blocks: T-014, T-015

- [x] **T-006** (complexity: 1) - Add i18n keys for ai_chat unavailable copy in es/en/pt
  - Add OQ-8 i18n keys ("AI chat is not available for this accommodation") in all three locales
  - Blocked by: none
  - Blocks: T-007

### Core Phase

- [x] **T-007** (complexity: 3) - Implement resolveOwnerLimitsForOwnerId in owner-entitlement.ts
  - Add `resolveOwnerLimitsForOwnerId(ownerId)` to `apps/api/src/middlewares/owner-entitlement.ts`
  - Blocked by: T-006
  - Blocks: T-009

- [x] **T-008** (complexity: 2) - Define Model C field-split table as exhaustive TypeScript constant
  - Create `packages/billing/src/config/model-c-field-split.ts` classifying all §8.2 columns
  - Blocked by: T-001, T-003, T-004
  - Blocks: T-010, T-011

- [x] **T-009** (complexity: 3) - Inline owner-scoped gate, quota check, and metering in chat route handler
  - Replace tourist-keyed quota middleware with inline owner-scoped logic in chat.ts
  - Blocked by: T-007
  - Blocks: T-013

- [x] **T-010** (complexity: 3) - Update billingPlans.seed.ts capability-layer sync policy
  - Replace warn-only with per-field Model C sync policy in billingPlans.seed.ts
  - Blocked by: T-008
  - Blocks: T-011

### Integration Phase

- [x] **T-011** (complexity: 3) - Write idempotent Model C extras migration (finite limits + capability removals)
  - Create extras migration SQL covering all phases: finite limits + AI_CHAT/AI_SEARCH removals + general capability sync
  - Blocked by: T-001, T-003, T-004, T-008, T-010
  - Blocks: T-012, T-013, T-014

- [ ] **T-014** (complexity: 3) - Refactor search route to drop quota gate and require auth
  - Remove createAiQuotaMiddleware from search route; add login-prompt for anonymous users
  - Blocked by: T-005, T-011
  - Blocks: T-015, T-016

### Testing Phase

- [x] **T-012** (complexity: 3) - Write real-DB integration tests for Model C extras migration
  - Real-DB integration tests for migration: idempotency, scoping, capability addition, commercial no-clobber
  - Blocked by: T-002, T-011
  - Blocks: T-016

- [ ] **T-013** (complexity: 3) - Write chat route owner-metered integration tests
  - Integration tests: AC-1.2 (recordAiUsage keyed by ownerId), AC-1.3 (owner-at-quota → 403), AC-1.4, AC-1.5
  - Blocked by: T-009, T-011
  - Blocks: T-016

- [ ] **T-015** (complexity: 3) - Write ai_support addon entitlement and metering integration tests
  - Tests: AC-4.1 (addon surfaces AI_SUPPORT), AC-4.2 (host-metered), AC-4.3 (§6.2 grant matrix snapshot)
  - Blocked by: T-005, T-014
  - Blocks: T-016

### Docs Phase

- [ ] **T-016** (complexity: 2) - Add staging billing smoke checklist entries for SPEC-211
  - Add 4 staging smoke entries + prod smoke entries to SPEC-143 checklists
  - Blocked by: T-012, T-013, T-014, T-015
  - Blocks: T-017

- [ ] **T-017** (complexity: 2) - Update packages/billing/CLAUDE.md with Model C two-layer model
  - Document Model C in billing/CLAUDE.md + docs/billing/adding-an-entitlement.md
  - Blocked by: T-016
  - Blocks: none

---

## Dependency Graph

```
Level 0 (no deps, start here):
  T-001 Replace -1 AI quotas [setup]
  T-002 Set USD cost ceilings [setup]
  T-004 Remove ai_search from all plans [setup]
  T-005 Add ai_support addon [setup]
  T-006 Add i18n keys for ai_chat unavailable [setup]

Level 1:
  T-003 Remove ai_chat from tourist plans [setup]  <- T-001
  T-007 resolveOwnerLimitsForOwnerId [core]        <- T-006

Level 2:
  T-008 Model C field-split table [core]           <- T-001, T-003, T-004
  T-009 Chat route owner-scoped gate [core]        <- T-007

Level 3:
  T-010 billingPlans.seed.ts capability sync [core] <- T-008

Level 4:
  T-011 Model C extras migration [integration]     <- T-001, T-003, T-004, T-008, T-010

Level 5 (parallel):
  T-012 Real-DB migration tests [testing]          <- T-002, T-011
  T-013 Chat owner-metered tests [testing]         <- T-009, T-011
  T-014 Search route refactor [integration]        <- T-005, T-011

Level 6:
  T-015 ai_support addon tests [testing]           <- T-005, T-014

Level 7:
  T-016 Billing smoke checklist [docs]             <- T-012, T-013, T-014, T-015

Level 8:
  T-017 Billing CLAUDE.md Model C docs [docs]      <- T-016
```

## Critical Path

T-001 → T-003 → T-008 → T-010 → T-011 → T-013 → T-016 → T-017 (8 steps, weighted 18)

## Parallel Tracks

- **Track A (config + Model C setup):** T-001 → T-003 → T-008 → T-010 → T-011
- **Track B (ai_search removal):** T-004 → T-008 → T-011 (joins Track A at T-008)
- **Track C (chat owner-governance):** T-006 → T-007 → T-009 → T-013 (joins Track A at T-011)
- **Track D (ai_support addon):** T-005 → T-014 → T-015 (joins at T-016)

T-002 (USD ceiling config) runs independently and joins at T-012.

## Suggested Start

Begin with these **4 tasks in parallel** (all have no dependencies):

1. **T-001** (complexity: 1) - Replace -1 AI quotas in plans.config.ts — unblocks T-003, T-008, T-011
2. **T-004** (complexity: 1) - Remove ai_search from all plans — unblocks T-008, T-011
3. **T-006** (complexity: 1) - Add i18n keys — unblocks T-007
4. **T-002** (complexity: 2) - Set USD ceilings — unblocks T-012

T-005 (ai_support addon) can also start immediately alongside these four.

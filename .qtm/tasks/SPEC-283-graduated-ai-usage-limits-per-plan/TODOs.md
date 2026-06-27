# SPEC-283 — Graduated Per-Plan AI Usage Limits

**Progress: 0/15 tasks (0%)**
**Average Complexity: 2.1/3**
**Critical Path: T-002 -> T-003 -> T-005 -> T-013 -> T-015**
**Parallel Tracks: 5**

> Billing + runtime half of two-part AI monetization effort. Reverts SPEC-211 G-2/G-4 on the metering axis: re-introduces per-plan monthly quota for ai_search (consumer-keyed), adds consumer-side graduated quota for ai_chat on top of existing owner-side gate.

---

## Suggested Start

Begin with the parallel no-dependency roots:

- **T-001** (owner decision — blocks T-003 and T-009)
- **T-002** (LimitKey addition — blocks T-003 and T-008; can start immediately)
- **T-004** (i18n keys — blocks T-008 and T-012; can start immediately)
- **T-006** (middleware extension — blocks T-007; can start immediately)
- **T-014** (spec doc amendment — no dependencies, no blockers)

---

## Phase: Setup

- [ ] **T-001** (complexity: 1) - Confirm OQ-3 numeric quota values with owner
  Present §5 placeholder table (free=10, plus=50, vip=200, owner/complex=200) to owner; record confirmed values in engram under topic_key: spec/SPEC-283/quota-values.
  Blocked by: (none)
  Blocks: T-003, T-009

---

## Phase: Core

- [ ] **T-002** (complexity: 2) - Add MAX_AI_CHAT_CONSUMER_PER_MONTH LimitKey to billing types, LIMIT_METADATA, and RESOURCE_NAMES
  Add new enum value to packages/billing/src/types/plan.types.ts, LIMIT_METADATA entry in packages/billing/src/config/limits.config.ts, and RESOURCE_NAMES entry in apps/api/src/utils/limit-check.ts. All three are Record<LimitKey,…> exhaustive maps — compile error if missing.
  Blocked by: (none)
  Blocks: T-003, T-008

- [ ] **T-003** (complexity: 3) - Add ai_search per-plan limits and consumer chat quota values to plans.config.ts
  Restore MAX_AI_SEARCH_PER_MONTH and add MAX_AI_CHAT_CONSUMER_PER_MONTH to all 9 plans in packages/billing/src/config/plans.config.ts. Update TOURIST_VIP_LIMITS for inheritance by owner/complex plans.
  Blocked by: T-001, T-002
  Blocks: T-005, T-010

- [ ] **T-004** (complexity: 2) - Add consumer-limit-reached i18n keys for ai_chat (es/en/pt)
  Add consumerLimitReached and consumerLimitUpgradeCta keys to aiChat namespace in packages/i18n/src/locales/{es,en,pt}/accommodations.json. Run generate-types after.
  Blocked by: (none)
  Blocks: T-008, T-012

- [ ] **T-005** (complexity: 2) - Write idempotent Model C extras migration 023 for new AI limit keys
  Create packages/db/src/migrations/extras/023-billing-plans-ai-consumer-search-limits.plan.sql with OR-PRESERVE idempotent UPDATE statements for both new limit keys across all 9 accommodation plan slugs.
  Blocked by: T-003
  Blocks: T-013, T-015

- [ ] **T-006** (complexity: 2) - Extend createAiQuotaMiddleware to support skipEntitlementGate option for auth-baseline features
  Add AiQuotaMiddlewareOptions type and optional second param to createAiQuotaMiddleware in apps/api/src/middlewares/ai-quota.ts. Guards step 3 entitlement check for auth-baseline features (ai_search has no plan entitlement).
  Blocked by: (none)
  Blocks: T-007

---

## Phase: Integration

- [ ] **T-007** (complexity: 2) - Re-add search quota middleware to search-chat.ts
  Add createAiQuotaMiddleware('search', { skipEntitlementGate: true }) to middleware stack in apps/api/src/routes/ai/protected/search-chat.ts. Update JSDoc to reference SPEC-283 reversal of SPEC-211 §7.7.
  Blocked by: T-006
  Blocks: T-011, T-015

- [ ] **T-008** (complexity: 3) - Add consumer-side quota gate and meter to chat.ts
  Insert consumer quota check (getRemainingLimit + getMonthlyCallCount keyed on actor.id with MAX_AI_CHAT_CONSUMER_PER_MONTH) before streaming in apps/api/src/routes/ai/protected/chat.ts. Two distinct 403 i18n keys: owner=aiChat.unavailable, consumer=aiChat.consumerLimitReached. Record consumer usage in augmentedMeta.then.
  Blocked by: T-002, T-004
  Blocks: T-012, T-015

- [ ] **T-009** (complexity: 2) - Update SPEC-282 comparison table to show graduated per-tier AI numbers
  Replace binary AI indicator rows with graduated quota values in the plan comparison table component(s) in apps/web/. External dependency: SPEC-282 must be merged to staging first. Component paths need grounding at implementation time.
  Blocked by: T-001
  Blocks: (none)

---

## Phase: Testing

- [ ] **T-010** (complexity: 2) - Update grant-matrix snapshot test to reflect new AI limit keys
  Update AI_LIMIT_KEYS and EXPECTED_AI_MATRIX in packages/billing/test/grant-matrix.snapshot.test.ts to include both MAX_AI_SEARCH_PER_MONTH and MAX_AI_CHAT_CONSUMER_PER_MONTH with T-003 values.
  Blocked by: T-003
  Blocks: (none)

- [ ] **T-011** (complexity: 2) - Write search-chat route quota gate tests
  Extend apps/api/test/integration/ai/search-chat.test.ts with 5 test cases: under-quota pass, quota-reached 403, limit=0 immediate-block, skipEntitlementGate verification, billingLoadFailed 503.
  Blocked by: T-007
  Blocks: T-015

- [ ] **T-012** (complexity: 3) - Write chat route consumer-side gate tests
  Extend apps/api/test/integration/ai/chat-route.test.ts with 6 test cases covering both-sided gate: owner-block (aiChat.unavailable), consumer-block (aiChat.consumerLimitReached), both-pass, consumer-block-while-owner-has-quota, consumer-limit=0, consumer recordAiUsage assertion.
  Blocked by: T-008
  Blocks: T-015

- [ ] **T-013** (complexity: 2) - Write extras migration 023 idempotency test
  Create packages/db/test/integration/023-ai-consumer-search-limits.migration.test.ts following spec-211-ai-monetization-migration.test.ts pattern. Covers first-apply, idempotency, OR-PRESERVE, commerce-plan unaffected. Use withCleanSlate (not withTestTransaction).
  Blocked by: T-005
  Blocks: T-015

- [ ] **T-015** (complexity: 1) - Execute billing staging smoke for AI gate changes
  Deploy changes to staging, run migration 023, execute 4 smoke scenarios per SPEC-143 policy (search quota, consumer chat block, owner block regression, DB verification). File sign-off in staging-smoke-checklist.md.
  Blocked by: T-007, T-008, T-005, T-011, T-012, T-013
  Blocks: (none)

---

## Phase: Docs

- [ ] **T-014** (complexity: 1) - Amend SPEC-211 spec doc to record reversal of G-2 and G-4
  Append dated amendment section to .qtm/specs/SPEC-211-ai-monetization-model/spec.md documenting SPEC-283 reversals of G-2 (consumer quota restored) and G-4 (search quota restored). Mandatory per SPEC-283 §3 G-5.
  Blocked by: (none)
  Blocks: (none)

---

## Dependency Graph

```
Level 1 (parallel, no deps):
  T-001  T-002  T-004  T-006  T-014

Level 2 (resolved after level 1):
  T-003 (needs T-001 + T-002)
  T-007 (needs T-006)
  T-008 (needs T-002 + T-004)

Level 3 (resolved after level 2):
  T-005 (needs T-003)
  T-009 (needs T-001)
  T-010 (needs T-003)
  T-011 (needs T-007)
  T-012 (needs T-008)

Level 4 (resolved after level 3):
  T-013 (needs T-005)

Level 5 (resolved after level 4):
  T-015 (needs T-007 + T-008 + T-005 + T-011 + T-012 + T-013)
```

**Critical path** (longest sequential chain): `T-002 -> T-003 -> T-005 -> T-013 -> T-015`

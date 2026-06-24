# SPEC-277: Accommodation import — scraper resilience

## Progress: 0/11 tasks (0%)

**Average Complexity:** 2.2/3 (max)
**Critical Path:** T-004 → T-005 → T-008 (3 steps, weighted: 8)
**Parallel Tracks:** 4 identified

**Scope:** R1 (retry) + R2 (fallback chain) + R4 (provider mitigation doc) + R5 (manual path invariant). R3 (async path) is DEFERRED to a follow-up spec.

---

### Core Phase

- [ ] **T-001** (complexity: 2) — Add RETRYABLE_FAILURE_CODES constant and withRetry wrapper to apify-client.ts
  - `packages/service-core/src/services/accommodation-import/adapters/apify-client.ts`
  - Exports `RETRYABLE_FAILURE_CODES` set, `withRetry` with jittered backoff (2 retries max, base 500ms–1s + random jitter)
  - Blocked by: none
  - Blocks: T-002, T-003, T-006

- [ ] **T-002** (complexity: 2) — Wire withRetry into AirbnbAdapter.extract()
  - `packages/service-core/src/services/accommodation-import/adapters/airbnb.adapter.ts`
  - Wraps `runApifyActor` call site with `withRetry`; existing adapter tests must still pass
  - Blocked by: T-001
  - Blocks: T-007

- [ ] **T-003** (complexity: 2) — Wire withRetry into BookingAdapter.extract()
  - `packages/service-core/src/services/accommodation-import/adapters/booking.adapter.ts`
  - Only the actor call site (not JSON-LD path); existing tests must still pass
  - Blocked by: T-001
  - Blocks: T-007

- [ ] **T-004** (complexity: 2) — Implement runFallbackGenericExtract helper function
  - `packages/service-core/src/services/accommodation-import/accommodation-import.service.ts`
  - Private method `_runFallbackGenericExtract(url, context)` — single cheap safeExternalFetch via GenericAdapter; never throws
  - Blocked by: none
  - Blocks: T-005

- [ ] **T-005** (complexity: 3) — Wire R2 fallback chain into AccommodationImportService.importFromUrl()
  - `packages/service-core/src/services/accommodation-import/accommodation-import.service.ts`
  - Trigger: `source_blocked` + source is `airbnb` or `booking`; merge fallback RawExtraction preserving sourcePlatform; force partial=true
  - Blocked by: T-004
  - Blocks: T-008

### Testing Phase

- [ ] **T-006** (complexity: 2) — Write unit tests for withRetry (retry policy, fail-fast, jitter, cap)
  - `packages/service-core/test/services/accommodation-import/adapters/apify-client.test.ts`
  - 9 test cases: retry on source_blocked/timeout, fail-fast on 4 non-retryable codes, first-success shortcut, default maxRetries, custom maxRetries
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-007** (complexity: 2) — Write adapter retry integration tests for Airbnb and Booking adapters
  - `packages/service-core/test/services/accommodation-import/adapters/airbnb.adapter.test.ts`
  - `packages/service-core/test/services/accommodation-import/adapters/booking.adapter.test.ts`
  - 3 cases per adapter: retry succeeds, cap enforced, fail-fast on credentials_missing
  - Blocked by: T-002, T-003
  - Blocks: none

- [ ] **T-008** (complexity: 3) — Write service-level tests for R2 fallback chain
  - `packages/service-core/test/services/accommodation-import/accommodation-import.service.test.ts`
  - 5 test cases: Airbnb fallback success, Booking fallback success, fallback returns nothing, non-retryable skips fallback, non-Airbnb/Booking skips fallback
  - Blocked by: T-005
  - Blocks: none

- [ ] **T-009** (complexity: 2) — Write ImportFromUrl.client.tsx invariant test — form stays usable after full failure
  - `apps/web/src/components/host/__tests__/ImportFromUrl.test.tsx` (new file)
  - 4 test cases: source_blocked failure, timeout failure, HTTP error, in-flight disabled state
  - Blocked by: none
  - Blocks: none

- [ ] **T-010** (complexity: 2) — Write ImportFromUrlSection.tsx invariant test — form stays usable after full failure
  - `apps/admin/src/features/accommodations/components/__tests__/ImportFromUrlSection.test.tsx`
  - 3 new test cases in R5 invariant describe block; reuses existing mock infrastructure
  - Blocked by: none
  - Blocks: none

### Docs Phase

- [ ] **T-011** (complexity: 1) — Write provider-mitigation runbook (R4)
  - `packages/service-core/src/services/accommodation-import/docs/provider-mitigation-runbook.md` (new file)
  - Covers: actor swap steps, residential proxy, all apify*Actor config fields, config seam audit result
  - Blocked by: none
  - Blocks: none

---

## Dependency Graph

```
Level 0 (start — no dependencies):
  T-001  Add withRetry to apify-client.ts
  T-004  Implement _runFallbackGenericExtract
  T-009  Web ImportFromUrl invariant test
  T-010  Admin ImportFromUrlSection invariant test
  T-011  Provider-mitigation runbook

Level 1 (unblocked after Level 0):
  T-002  Wire withRetry → AirbnbAdapter      [requires T-001]
  T-003  Wire withRetry → BookingAdapter     [requires T-001]
  T-005  Wire R2 fallback → orchestrator     [requires T-004]
  T-006  Unit tests for withRetry            [requires T-001]

Level 2:
  T-007  Adapter retry integration tests     [requires T-002 + T-003]
  T-008  Service fallback chain tests        [requires T-005]
```

**Critical path (weighted by complexity):**
`T-004 (2) → T-005 (3) → T-008 (3)` = weighted length 8

**Parallel tracks:**

- Track A (R1 core):   T-001 → T-002 → T-007
- Track A' (R1 core):  T-001 → T-003 → T-007
- Track A'' (R1 test): T-001 → T-006
- Track B (R2 CRITICAL PATH): T-004 → T-005 → T-008
- Track C (R4+R5 independent): T-009, T-010, T-011

**PR slicing guidance:**

- **PR 1 (R1 + R5):** T-001, T-002, T-003, T-006, T-007, T-009, T-010
- **PR 2 (R2 + R4):** T-004, T-005, T-008, T-011

T-009, T-010, and T-011 have no code dependencies and can be done in either PR or in parallel with any other track.

## Suggested Start

Begin with **T-001** (complexity: 2) and **T-004** (complexity: 2) in parallel — both have no dependencies. T-001 unblocks the entire R1 track (T-002, T-003, T-006, T-007). T-004 starts the critical path (T-004 → T-005 → T-008).

Also start **T-009**, **T-010**, and **T-011** anytime — they are fully independent.

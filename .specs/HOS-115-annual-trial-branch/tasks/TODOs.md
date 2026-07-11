# HOS-115: Grant the no-card trial on the annual first-time checkout path

## Progress: 0/14 tasks (0%)

**Average Complexity:** 2.1/3 (max)
**Critical Path:** T-001 -> T-002 -> T-003 -> T-004 -> T-011 (5 steps)
**Parallel Tracks:** 3 identified (API core, web toggle, i18n)

---

### Core Phase

- [ ] **T-001** (complexity: 1) - Widen annual checkout result type to allow the trial effect
  - Type-only: annual result gains appliedEffect: 'trial' + optional promoCodeIgnored
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-002** (complexity: 3) - Add the trial-eligibility branch to initiatePaidAnnualSubscription
  - Insert trial branch after COMP, before discount, mirroring monthly ~L541-635
  - Blocked by: T-001
  - Blocks: T-003, T-009

- [ ] **T-003** (complexity: 3) - Persist intendedInterval on the trial subscription metadata (both paths)
  - Thread intendedInterval into startTrial(); stamp 'annual'/'monthly' in metadata (no migration)
  - Blocked by: T-002
  - Blocks: T-004, T-010

### Integration Phase

- [ ] **T-004** (complexity: 2) - Append ?interval to the TRIAL_EXPIRED notification upgradeUrl
  - Nudge delivery path 1: read intendedInterval, append ?interval= to upgradeUrl
  - Blocked by: T-003
  - Blocks: T-012

- [ ] **T-005** (complexity: 2) - Web: show the trial copy under the annual toggle
  - Rename .pricing-card__trial--monthly to neutral class, drop from annual hide rule
  - Blocked by: none
  - Blocks: T-006, T-013

- [ ] **T-006** (complexity: 2) - Web: pre-select the toggle from the ?interval query param
  - Read ?interval= on load, set initial data-billing (nudge); manual flip never overridden
  - Blocked by: T-005
  - Blocks: T-013

- [ ] **T-007** (complexity: 1) - i18n: confirm/adjust interval-neutral trial copy (es/en/pt)
  - Ensure pricing.trial does not imply monthly-only; edit only if needed
  - Blocked by: none
  - Blocks: none

- [ ] **T-008** (complexity: 3) - Fast-follow: expose intendedInterval on the trial-status surface
  - OPTIONAL secondary nudge path (direct navigation, no query param)
  - Blocked by: T-003
  - Blocks: none

### Testing Phase

- [ ] **T-009** (complexity: 3) - Unit tests: annual trial branch (eligibility + promo precedence)
  - AC-1/AC-2/AC-5/AC-7
  - Blocked by: T-002
  - Blocks: none

- [ ] **T-010** (complexity: 2) - Unit test: intendedInterval stamped on both paths
  - AC-8
  - Blocked by: T-003
  - Blocks: none

- [ ] **T-011** (complexity: 3) - Integration test: annual trial via /start-paid + cancel-only expiry
  - AC-1 route-level + AC-3 expiry cancel-only
  - Blocked by: T-002, T-004
  - Blocks: none

- [ ] **T-012** (complexity: 2) - Test: analytics reuses checkout_started for annual -> trial
  - AC-10 / OQ-2: billingInterval='annual' + appliedEffect='trial', no new event
  - Blocked by: T-002
  - Blocks: none

- [ ] **T-013** (complexity: 2) - Web test: annual toggle shows trial copy + ?interval pre-select
  - AC-6 + AC-9
  - Blocked by: T-005, T-006
  - Blocks: none

### Docs Phase

- [ ] **T-014** (complexity: 1) - Docs + closeout: annual trial branch
  - Update trial-system/gate-matrix docs; apply status-needs-smoke-staging; closeout
  - Blocked by: T-002, T-005
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-005, T-007
Level 1: T-002, T-006
Level 2: T-003, T-009, T-012, T-013, T-014
Level 3: T-004, T-008, T-010
Level 4: T-011

## Suggested Start

Begin with **T-001** (complexity: 1) - no dependencies, unblocks the API core chain (T-002 -> T-003 -> T-004). In parallel, **T-005** (web toggle) and **T-007** (i18n audit) can be picked up independently.

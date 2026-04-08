# SPEC-027: Webhook Subscription Sync

## Progress: 0/20 tasks (0%)

**Average Complexity:** 2.4/4 (max)
**Critical Path:** T-001 -> T-003 -> T-004 -> T-014 -> T-015 -> T-019 -> T-020 (7 steps)
**Parallel Tracks:** 4 identified

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Create billing_subscription_events Drizzle schema
  - New table schema + barrel export + migration
  - Blocked by: none
  - Blocks: T-003, T-004, T-016

- [ ] **T-002** (complexity: 2) - Create subscription event Zod schema for admin API response
  - Zod schemas + barrel export in packages/schemas
  - Blocked by: none
  - Blocks: T-016

### Core Phase

- [ ] **T-003** (complexity: 3) - Create status mapping constant and notification helper functions
  - QZPAY_TO_HOSPEDA_STATUS map + 4 shouldSend* helpers + tests (22 cases)
  - Blocked by: T-001
  - Blocks: T-004

- [ ] **T-004** (complexity: 4) - Implement processSubscriptionUpdated business logic
  - Main 10-step function + interfaces + tests (12 cases)
  - Blocked by: T-003
  - Blocks: T-005, T-006, T-014

- [ ] **T-005** (complexity: 2) - Rewrite subscription-handler.ts
  - Replace handler body + tests (3 cases)
  - Blocked by: T-004
  - Blocks: T-015

- [ ] **T-006** (complexity: 3) - Update webhook-retry.job.ts
  - Split case block + retrySubscriptionUpdated function + tests (2 cases)
  - Blocked by: T-004
  - Blocks: T-015

### Notifications Phase

- [ ] **T-007** (complexity: 2) - Add NotificationType enum values and SubscriptionLifecyclePayload
  - 3 enum values + interface + union update
  - Blocked by: none
  - Blocks: T-008, T-009, T-010, T-011, T-012

- [ ] **T-008** (complexity: 1) - Add subject patterns and category mappings
  - 3 subjects + 3 categories
  - Blocked by: T-007
  - Blocks: T-012

- [ ] **T-009** (complexity: 2) - Create subscription-cancelled email template
  - Template with Spanish text, CTA, showUnsubscribe=false
  - Blocked by: T-007
  - Blocks: T-011, T-013

- [ ] **T-010** (complexity: 2) - Create subscription-paused and subscription-reactivated templates
  - 2 templates with Spanish text, CTAs
  - Blocked by: T-007
  - Blocks: T-011, T-013

- [ ] **T-011** (complexity: 2) - Create barrel exports and wire templates into selectTemplate
  - Barrel + 3 cases in selectTemplate()
  - Blocked by: T-009, T-010
  - Blocks: T-013, T-014

- [ ] **T-012** (complexity: 3) - Add notification helper functions to webhook notifications.ts
  - 3 RO-RO functions with admin alert logic
  - Blocked by: T-007, T-008
  - Blocks: T-014

- [ ] **T-013** (complexity: 3) - Write notification template tests
  - 16 assertions across 3 templates
  - Blocked by: T-011
  - Blocks: T-015

- [ ] **T-014** (complexity: 3) - Wire notification calls into processSubscriptionUpdated
  - Customer/plan lookup + notification dispatch + tests (7 cases)
  - Blocked by: T-004, T-011, T-012
  - Blocks: T-015

### Integration Checkpoint

- [ ] **T-015** (complexity: 2) - Run full test suite and verify Phase 1+2 quality gate
  - typecheck + lint + tests + coverage
  - Blocked by: T-005, T-006, T-013, T-014
  - Blocks: T-016, T-017, T-018, T-019

### Admin Phase

- [ ] **T-016** (complexity: 3) - Create admin API route for subscription events
  - GET /:id/events with pagination + mount in admin router
  - Blocked by: T-001, T-002, T-015
  - Blocks: T-020

- [ ] **T-017** (complexity: 1) - Add paused status to admin SubscriptionStatus type and utils
  - Type + getStatusVariant + getStatusLabel
  - Blocked by: T-015
  - Blocks: T-019

- [ ] **T-018** (complexity: 2) - Add i18n keys for paused status and history tab
  - 3 locale files (es, en, pt)
  - Blocked by: T-015
  - Blocks: T-019

- [ ] **T-019** (complexity: 4) - Add useSubscriptionEventsQuery hook and update SubscriptionDetailsDialog
  - Hook + Tabs + Historial timeline + pagination
  - Blocked by: T-017, T-018
  - Blocks: T-020

### Final Verification

- [ ] **T-020** (complexity: 2) - Final quality gate and full integration verification
  - Full monorepo typecheck + lint + tests + coverage
  - Blocked by: T-016, T-019
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-007
Level 1: T-003, T-008, T-009, T-010
Level 2: T-004, T-011, T-012
Level 3: T-005, T-006, T-014
Level 4: T-013
Level 5: T-015
Level 6: T-016, T-017, T-018
Level 7: T-019
Level 8: T-020

## Parallel Tracks

**Track A (Core):** T-001 -> T-003 -> T-004 -> T-005/T-006
**Track B (Notifications Types):** T-007 -> T-008/T-009/T-010 -> T-011/T-012
**Track C (Admin Schema):** T-002 (independent until T-016)
**Track D (Admin UI):** T-017/T-018 -> T-019

Tracks A and B converge at T-014 (wire notifications into business logic).
Tracks A+B+C converge at T-015 (quality gate).
Track D starts after T-015.

## Suggested Start

Begin with **T-001** (complexity: 2), **T-002** (complexity: 2), and **T-007** (complexity: 2) in parallel - they have no dependencies and unblock 8 other tasks combined.

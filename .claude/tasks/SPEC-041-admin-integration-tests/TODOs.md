# SPEC-041: Admin Integration Tests

## Progress: 0/29 tasks (0%)

**Average Complexity:** 2.0/2.5 (max)
**Critical Path:** T-005 -> T-007 -> T-010 -> T-011 -> T-012 -> T-024 -> T-029 (7 steps)
**Parallel Tracks:** 4 identified

---

### Setup Phase (11 tasks)

- [ ] **T-001** (complexity: 1) - Add PointerEvent polyfill to test/setup.tsx
  - MockPointerEvent class + HTMLElement prototype patches for Radix UI
  - Blocked by: none
  - Blocks: T-008, T-009

- [ ] **T-002** (complexity: 1) - Add @repo/icons Proxy mock to test/setup.tsx
  - Global Proxy mock replacing 3 duplicate local mocks
  - Blocked by: none
  - Blocks: T-008, T-009

- [ ] **T-003** (complexity: 1.5) - Add useTranslations, RoutePermissionGuard, useAuthContext mocks to setup
  - 3 global mocks for page-level dependencies
  - Blocked by: none
  - Blocks: T-008, T-009

- [ ] **T-004** (complexity: 1.5) - Add @qazuor/qzpay-react mock and createLazyFileRoute mock to setup
  - QZPay components + lazy route mock for dashboard
  - Blocked by: none
  - Blocks: T-008, T-009

- [ ] **T-005** (complexity: 0.5) - Export response factory functions from handlers.ts
  - Verify mockPaginatedResponse, mockSuccessResponse, mockErrorResponse exports
  - Blocked by: none
  - Blocks: T-007

- [ ] **T-006** (complexity: 2) - Create test helpers (renderWithProviders, createTestQueryClient, waitForLoading)
  - 3 helper files in test/helpers/
  - Blocked by: none
  - Blocks: T-008, T-009

- [ ] **T-007** (complexity: 2.5) - Create entity fixtures (accommodation, destination, event, user, tag, post, sponsor)
  - 7 core entity fixture files derived from Zod schemas
  - Blocked by: T-005
  - Blocks: T-008, T-012

- [ ] **T-008** (complexity: 2.5) - Create billing fixtures (plan, addon, subscription, invoice, promo-code, promotion, sponsorship)
  - 7 billing entity fixture files
  - Blocked by: T-005
  - Blocks: T-012

- [ ] **T-009** (complexity: 1.5) - Create remaining fixtures (webhook-event, notification-log, role) and index.ts
  - 3 fixture files + barrel export
  - Blocked by: T-005
  - Blocks: T-010

- [ ] **T-010** (complexity: 2.5) - Create admin-handlers.ts for paginated entities
  - MSW handlers for ~20 admin entities (paginated + non-paginated)
  - Blocked by: T-007, T-008, T-009
  - Blocks: T-011

- [ ] **T-011** (complexity: 0.5) - Register admin handlers in server.ts
  - Import and spread admin handlers into setupServer
  - Blocked by: T-010
  - Blocks: T-012..T-023

### Core Phase — Smoke Tests (9 tasks)

- [ ] **T-012** (complexity: 2.5) - Smoke tests: Accommodations module (8 routes)
  - Blocked by: T-006, T-007, T-011
  - Blocks: T-024

- [ ] **T-013** (complexity: 2) - Smoke tests: Destinations module (7 routes)
  - Blocked by: T-006, T-007, T-011
  - Blocks: T-024

- [ ] **T-014** (complexity: 2) - Smoke tests: Events module — main routes (6 routes)
  - Blocked by: T-006, T-007, T-011
  - Blocks: T-024

- [ ] **T-015** (complexity: 2.5) - Smoke tests: Events locations + organizers (11 routes)
  - Blocked by: T-014
  - Blocks: T-024

- [ ] **T-016** (complexity: 2.5) - Smoke tests: Content module (12 routes)
  - Blocked by: T-006, T-007, T-011
  - Blocks: T-024

- [ ] **T-017** (complexity: 2.5) - Smoke tests: Billing module (14 routes)
  - Blocked by: T-006, T-008, T-011
  - Blocks: T-024

- [ ] **T-018** (complexity: 2) - Smoke tests: Access module (8 routes)
  - Blocked by: T-006, T-007, T-011
  - Blocks: T-024

- [ ] **T-019** (complexity: 2.5) - Smoke tests: Sponsors + Posts + Settings modules (20 routes)
  - Blocked by: T-006, T-007, T-011
  - Blocks: T-024

- [ ] **T-020** (complexity: 2.5) - Smoke tests: Dashboard + Analytics + Me + System (11 routes)
  - Blocked by: T-004, T-006, T-007, T-011
  - Blocks: T-024

### Integration Phase — CRUD + Table + Dialog Tests (8 tasks)

- [ ] **T-021** (complexity: 2.5) - CRUD tests: Accommodations create flow
  - 4 tests: valid submit, empty validation, API error, pending state
  - Blocked by: T-006, T-007, T-011
  - Blocks: T-025

- [ ] **T-022** (complexity: 2) - CRUD tests: Accommodations edit flow
  - 3 tests: pre-fill, edit submit, 404 error
  - Blocked by: T-021
  - Blocks: T-025

- [ ] **T-023** (complexity: 2) - CRUD tests: Users create flow
  - 3 tests: valid submit, validation errors, API error
  - Blocked by: T-006, T-007, T-011
  - Blocks: T-025

- [ ] **T-024** (complexity: 2.5) - Table interaction tests: Accommodations sort + pagination
  - 3 tests: sort params, pagination, row edit action
  - Blocked by: T-012
  - Blocks: T-025

- [ ] **T-025** (complexity: 2.5) - PlanDialog tests: Create mode
  - 4 tests: empty fields, valid submit, validation, Radix Select
  - Blocked by: T-001, T-006, T-008
  - Blocks: T-026

- [ ] **T-026** (complexity: 2) - PlanDialog tests: Edit mode + loading + cancel
  - 4 tests: pre-fill, save button, isSubmitting, cancel
  - Blocked by: T-025
  - Blocks: T-029

- [ ] **T-027** (complexity: 2.5) - PromoCodeFormDialog tests
  - 5 tests: auto-uppercase, discount types, edit mode, submit, cancel
  - Blocked by: T-001, T-006, T-008
  - Blocks: T-029

- [ ] **T-028** (complexity: 2) - Read-only dialog tests: InvoiceDetail, WebhookEvent, Notification
  - 7 tests across 3 dialogs
  - Blocked by: T-006, T-008, T-009
  - Blocks: T-029

### Testing Phase (1 task)

- [ ] **T-029** (complexity: 2) - Final validation: run full test suite and verify coverage
  - Full suite, coverage thresholds, typecheck, lint
  - Blocked by: T-024, T-026, T-027, T-028
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-003, T-004, T-005, T-006
Level 1: T-007, T-008, T-009
Level 2: T-010
Level 3: T-011
Level 4: T-012, T-013, T-014, T-016, T-017, T-018, T-019, T-020, T-021, T-023, T-025, T-027, T-028
Level 5: T-015, T-022, T-024, T-026
Level 6: T-029

## Parallel Tracks

1. **Setup mocks** (T-001..T-004) — all independent, run in parallel
2. **Fixtures** (T-007, T-008, T-009) — independent after T-005
3. **Smoke tests** (T-012..T-020) — mostly independent after T-011
4. **Integration tests** (T-021..T-028) — some dependencies between them

## Suggested Start

Begin with **T-001, T-002, T-003, T-004, T-005, T-006** in parallel (all complexity ≤ 2, no dependencies). This unblocks the entire pipeline.

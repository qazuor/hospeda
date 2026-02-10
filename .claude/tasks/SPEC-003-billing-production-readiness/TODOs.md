# TODOs: Billing System Production Readiness

Spec: SPEC-003 | Status: in-progress | Progress: 23/34

## Phase 0: Investigation (Setup)

- [ ] T-001: Investigate QZPay schema incompatibility (complexity: 4)

## Phase 1: Blockers - P0 (Core)

- [ ] T-002: Fix QZPay schema compatibility in seed files (complexity: 4) [blocked by T-001]
- [ ] T-003: Re-enable billing seeds in index.ts and verify (complexity: 3) [blocked by T-002]
- [x] T-004: Add Zod schemas for plan change request/response (complexity: 2) DONE
- [ ] T-005: Create plan change API endpoint (complexity: 4) [blocked by T-004]
- [ ] T-006: PlanChangeDialog: plan fetching, display UI, and plan selection (complexity: 3) [blocked by T-004, T-005]
- [ ] T-028: PlanChangeDialog: mutation, confirmation flow, error/loading states, and tests (complexity: 3) [blocked by T-005, T-006]
- [x] T-007: Make webhook secret mandatory in production mode (complexity: 2) DONE

## Phase 2: Security & Hardening - P1 (Core)

- [x] T-008: Fix SQL injection pattern in notification retention service (complexity: 2) DONE
- [x] T-009: Migrate local promo codes to database (complexity: 3) DONE
- [ ] T-010: Add startup validation for billing configuration (complexity: 3) [blocked by T-003]

## Phase 3: Test Coverage - P1 (Testing)

- [x] T-011: Write tests for MercadoPago webhook handler (complexity: 4) [blocked by T-007] DONE
- [x] T-012: Write tests for billing-metrics.service.ts (complexity: 3) DONE
- [x] T-013: Write tests for billing-settings.service.ts (complexity: 2) DONE
- [x] T-014: Write tests for addon-entitlement.service.ts (complexity: 2) DONE
- [x] T-029: Write tests for addon-expiration.service.ts (complexity: 2) DONE
- [x] T-015: Write tests for notification-retention.service.ts (complexity: 2) [blocked by T-008] DONE
- [x] T-030: Write tests for notification-retry.service.ts (complexity: 2) DONE
- [x] T-016: Write tests for billing-error-handler.ts (complexity: 2) DONE
- [x] T-031: Write tests for billing middleware (complexity: 2) DONE

## Phase 4: UI/DX Improvements - P2 (Integration)

- [x] T-017: Create BillingErrorBoundary component with tests (complexity: 2) DONE
- [x] T-032: Wrap billing components in error boundaries and add role='alert' (complexity: 2) [blocked by T-017] DONE
- [x] T-018: Configure Sentry release with git commit SHA (complexity: 2) DONE
- [x] T-019: Add database index for expiredAt on billing_notification_log (complexity: 1) DONE
- [x] T-020: Remove deprecated apiUrl props from billing components (complexity: 1) DONE

## Phase 5: i18n Billing (Integration)

- [x] T-021: Create billing i18n namespace with Spanish translations (complexity: 3) DONE
- [x] T-022: Create billing i18n namespace with English translations (complexity: 2) [blocked by T-021] DONE
- [x] T-023: Integrate i18n in core billing components - 7 components (complexity: 3) [blocked by T-021, T-022] DONE
- [ ] T-033: Integrate i18n in remaining billing components - 8 components (complexity: 3) [blocked by T-021, T-022, T-023]

## Phase 6: Performance (Integration)

- [x] T-024: Convert BillingMetricsService to singleton pattern (complexity: 3) [blocked by T-012] DONE
- [x] T-025: Review and optimize billing service instantiation patterns (complexity: 2) [blocked by T-024] DONE

## Phase 7: E2E & Validation (Testing)

- [ ] T-026: E2E tests: subscription creation, payment, and upgrade flow (complexity: 3) [blocked by T-005, T-011]
- [ ] T-034: E2E tests: downgrade, cancellation, and concurrent scenarios (complexity: 3) [blocked by T-026]
- [ ] T-027: Create E2E tests with MercadoPago sandbox (complexity: 4) [blocked by T-034]

---

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 34 |
| Total complexity | 84 |
| Average complexity | 2.5 |
| Max complexity | 4 |
| Critical path | T-001 -> T-002 -> T-003 -> T-010 |
| Longest chain | T-004 -> T-005 -> T-006 -> T-028 (3 hops) |
| Parallel tracks | 6 independent starting points |

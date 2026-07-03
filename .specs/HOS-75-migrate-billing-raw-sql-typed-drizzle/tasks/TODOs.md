# TODOs: Migrate billing raw-SQL column access to typed Drizzle

Spec: HOS-75 | Status: In Progress (Linear) | Progress: 19/28

## Setup

- [x] T-001: Confirm qzpay-drizzle 1.11.0 in worktree (complexity: 1)
- [x] T-002: Add loadSubscriptionDiscountState() shared helper (complexity: 2)

## Core — Phase A (product-domain, ~8 files)

- [x] T-003: Remove dual camelCase/snake_case read in isAccommodationSubscription (complexity: 1)
- [x] T-004: Migrate subscription-checkout.service.ts product_domain UPDATEs (complexity: 2)
- [x] T-005: Migrate subscription-comp-create.service.ts + update test mocks (complexity: 3)
- [x] T-006: Migrate listPlans.ts getNonAccommodationPlanSlugs() (complexity: 1)
- [x] T-007: Migrate partners/admin/list-plans.ts + write net-new test (complexity: 3)
- [x] T-008: Migrate featured-entitlement.resolver.ts product_domain SELECT (complexity: 1) [blocked by T-003]
- [x] T-009: Fold product_domain UPDATE into insert (commercePlan.seed.ts + partnerPlan.seed.ts) (complexity: 2)

## Core — Phase B (promo-codes, ~9 files)

- [x] T-010: Collapse promo-code.crud.ts column projection + fold persistEffectColumns() (complexity: 3)
- [x] T-011: Migrate promo-code.redemption.ts promo_effect_remaining_cycles UPDATE (complexity: 1)
- [x] T-012: Migrate promo-code.renewal.ts to use shared discount-state helper (complexity: 2) [blocked by T-002]
- [x] T-013: Migrate promo-code.trial-extension.ts raw-SQL effect-column access (complexity: 2) [needs-verification: exact site]
- [x] T-014: Migrate promo-discount-apply.service.ts SELECT + UPDATE (complexity: 2)
- [x] T-015: Migrate subscription-discount-signup.service.ts UPDATE (complexity: 1)
- [x] T-016: Fold effect-columns UPDATE into insert (billingPromoCodes.seed.ts) (complexity: 1)
- [x] T-017: Fix stale extras/018 comment in promo-code.schema.ts (complexity: 1)

## Integration — Phase C (webhooks/crons, ~5 files)

- [x] T-018: Migrate payment-logic.ts to use shared discount-state helper (complexity: 1) [blocked by T-002]
- [x] T-019: Migrate dunning.job.ts to use shared discount-state helper (complexity: 1) [blocked by T-002]
- [ ] T-020: Migrate apply-scheduled-plan-changes.ts to use shared discount-state helper (complexity: 1) [blocked by T-002]
- [ ] T-021: Migrate subscription-poll.job.ts bulk discount-amounts reconciliation (complexity: 2)
- [ ] T-022: Migrate subscription-promo-effect.ts admin diagnostic JOIN (complexity: 2)

## Docs

- [ ] T-023: Update root CLAUDE.md extras-carril references (complexity: 1)
- [ ] T-024: Update docs/guides/migrations.md extras-carril worked example (complexity: 1)
- [ ] T-025: Update ADR-035 extras-carril tradeoff note (complexity: 1)
- [ ] T-026: Fix packages/service-core/CLAUDE.md wrong migration filename + stale caveat (complexity: 1)
- [ ] T-027: Annotate stale product_domain reference in .specs/HOS-20/spec.md (complexity: 1)

## Testing

- [ ] T-028: Final scoped verification across all 3 phases (complexity: 2) [blocked by all T-001..T-027]

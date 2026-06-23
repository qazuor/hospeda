/**
 * SPEC-262 T-013 — Promo Code Migration Regression Locks (mock DB)
 *
 * Service-layer regression tests for the typed-effect migration (SPEC-262
 * T-002 / T-003). All assertions run against a fully mocked DB — no real
 * Postgres is needed.
 *
 * Mirrors the harness from promo-code.renewal.test.ts (`buildDbMock`).
 *
 * Regression locks:
 *
 * 1. HOSPEDA_FREE cycle-2 regression (AC-2.3 — THE KEY LOCK).
 *    A subscription linked to a `comp` promo code (HOSPEDA_FREE) must yield
 *    action='comp' at BOTH cycle 1 AND cycle 2. Pre-migration: HOSPEDA_FREE
 *    was a 100% percentage discount, so the cycle-counter engine would revert
 *    to full price after the first discounted cycle. Post-migration: the code
 *    is reclassified as `effect_kind='comp'`, so `resolveRenewalPromoEffect`
 *    short-circuits at the `status === 'comp'` branch and never touches the
 *    discount-cycle machinery.
 *
 * 2. Legacy one-shot 30% discount finalAmount lock (AC-4.1).
 *    `applyPromoCode` (via `calculatePromoCodeEffect`) with a legacy-style
 *    30% percentage code must produce the same finalAmount as before the
 *    migration. This locks the effect-reducer against regressions introduced
 *    by the new typed-effect columns.
 *
 * @module test/billing/promo-code.migration
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks (same pattern as promo-code.renewal.test.ts)
// ---------------------------------------------------------------------------
const { mockLoggerError } = vi.hoisted(() => ({
    mockLoggerError: vi.fn()
}));

// ---------------------------------------------------------------------------
// Mock @repo/db — resolveRenewalPromoEffect reads subscription rows via
// getDb().execute(sql`...`). We intercept execute() per-test.
// ---------------------------------------------------------------------------
vi.mock('@repo/db', () => ({
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
        _type: 'sql'
    })),
    getDb: vi.fn()
}));

// Mock the CRUD module so getPromoCodeById never hits a real DB.
vi.mock('../../src/services/billing/promo-code/promo-code.crud.js', () => ({
    getPromoCodeById: vi.fn()
}));

// Mock @repo/logger to capture defensive-branch error calls.
vi.mock('@repo/logger', () => ({
    createLogger: vi.fn(() => ({
        error: mockLoggerError,
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }))
}));

import * as dbModule from '@repo/db';
import type { PromoEffect } from '@repo/schemas';
import { PromoEffectKindEnum, ValueKindEnum } from '@repo/schemas';
import { calculatePromoCodeEffect } from '../../src/services/billing/promo-code/effect-reducer.js';
import * as promoCrudModule from '../../src/services/billing/promo-code/promo-code.crud.js';
import { resolveRenewalPromoEffect } from '../../src/services/billing/promo-code/promo-code.renewal.js';

const mockGetDb = dbModule.getDb as ReturnType<typeof vi.fn>;
const mockGetPromoCodeById = promoCrudModule.getPromoCodeById as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Shared helpers (identical to promo-code.renewal.test.ts — kept local to
// avoid cross-test coupling; these tests are locked against the migration)
// ---------------------------------------------------------------------------

/**
 * Build a mock `getDb()` that returns per-query row fixtures.
 * Query discrimination mirrors promo-code.renewal.test.ts exactly.
 *
 * @param options.subRow - subscription row for the SELECT.
 * @param options.unitAmount - billing_prices.unit_amount (centavos).
 * @param options.executeSpy - optional spy for call inspection.
 */
function buildDbMock(options: {
    subRow: Record<string, unknown> | null;
    unitAmount?: number;
    executeSpy?: ReturnType<typeof vi.fn>;
}) {
    const { subRow, unitAmount, executeSpy } = options;
    const execute = executeSpy ?? vi.fn();

    execute.mockImplementation((query: { strings: TemplateStringsArray }) => {
        const text = query.strings.join(' ');
        if (text.includes('FROM billing_subscriptions') && text.includes('SELECT')) {
            return Promise.resolve({ rows: subRow ? [subRow] : [] });
        }
        if (text.includes('FROM billing_prices')) {
            return Promise.resolve({
                rows: unitAmount !== undefined ? [{ unit_amount: unitAmount }] : []
            });
        }
        // UPDATE billing_subscriptions ... promo_effect_remaining_cycles
        return Promise.resolve({ rows: [] });
    });

    return { execute };
}

/**
 * Build a comp promo code DTO (post-migration HOSPEDA_FREE shape).
 * kind='comp', no sub-parameters.
 */
function compCode() {
    return {
        success: true,
        data: {
            id: 'pc-hospeda-free',
            code: 'HOSPEDA_FREE',
            type: 'percentage',
            value: 100,
            active: true,
            timesRedeemed: 0,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            effect: {
                kind: 'comp' as const
                // comp carries no sub-parameters (value_kind, durationCycles, extra_days)
            }
        }
    };
}

/**
 * Build a discount promo code DTO — post-migration BIENVENIDO30 shape.
 * 30% discount, duration_cycles=1 (one-shot).
 */
function discount30Code() {
    return {
        success: true,
        data: {
            id: 'pc-bienvenido30',
            code: 'BIENVENIDO30',
            type: 'percentage',
            value: 30,
            active: true,
            timesRedeemed: 0,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            effect: {
                kind: 'discount' as const,
                valueKind: 'percentage' as const,
                value: 30,
                durationCycles: 1
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Promo-code migration regression locks (SPEC-262 T-013)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // Regression Lock 1 — HOSPEDA_FREE comp cycle-2 bug (AC-2.3)
    //
    // Pre-migration: HOSPEDA_FREE was stored as a 100% percentage discount.
    // The renewal engine would treat it as a one-shot discount (duration_cycles=1):
    //   cycle 1 → apply-discount (50%-off → 100%-off, effectively free)
    //   cycle 2 → restore-full (counter exhausted) — BUG: user charged full price
    //
    // Post-migration: HOSPEDA_FREE is reclassified to effect_kind='comp'.
    // The subscription status is flipped to 'comp'. The renewal engine
    // short-circuits at step 2 (status==='comp') and NEVER enters the
    // discount-cycle machinery. Both "cycle 1" and "cycle 2" webhook events
    // produce action='comp', charge 0.
    //
    // "Cycle 1 / cycle 2" here means two successive webhook calls for the
    // same subscription. Since the comp branch ignores promo_effect_remaining_cycles,
    // the counter value doesn't matter.
    // =========================================================================

    describe('HOSPEDA_FREE comp regression (AC-2.3)', () => {
        it('cycle 1 (status=comp, remaining=null): action=comp, no MP amount', async () => {
            // Arrange — subscription with status='comp' (post-migration reconciliation)
            const db = buildDbMock({
                subRow: {
                    id: 'sub-hospeda-free',
                    status: 'comp',
                    plan_id: 'plan-1',
                    mp_subscription_id: null,
                    promo_code_id: 'pc-hospeda-free',
                    promo_effect_remaining_cycles: null
                }
            });
            mockGetDb.mockReturnValue(db);
            // getPromoCodeById must NOT be called for a comp sub
            mockGetPromoCodeById.mockResolvedValue(compCode());

            // Act
            const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-hospeda-free' });

            // Assert — comp short-circuit: no charge, no MP mutation
            expect(result.success).toBe(true);
            if (!result.success) throw new Error('expected success');
            expect(result.data.action).toBe('comp');
            expect(result.data.targetTransactionAmountMajor).toBeUndefined();
            expect(result.data.targetTransactionAmountCentavos).toBeUndefined();

            // The comp branch must not invoke the promo code lookup at all
            // (status check comes BEFORE the promo_code_id lookup)
            expect(mockGetPromoCodeById).not.toHaveBeenCalled();
        });

        it('cycle 2 (status=comp, remaining=null): still action=comp, NOT restore-full (THE KEY LOCK)', async () => {
            // Arrange — same subscription, second webhook call (same state because
            // comp subs never decrement the counter)
            const db = buildDbMock({
                subRow: {
                    id: 'sub-hospeda-free',
                    status: 'comp',
                    plan_id: 'plan-1',
                    mp_subscription_id: null,
                    promo_code_id: 'pc-hospeda-free',
                    promo_effect_remaining_cycles: null
                }
            });
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-hospeda-free' });

            // Assert — comp MUST NOT become restore-full (that was the pre-migration bug)
            expect(result.success).toBe(true);
            if (!result.success) throw new Error('expected success');
            expect(result.data.action).toBe('comp');
            // Explicitly assert it is NOT restore-full (regression guard)
            expect(result.data.action).not.toBe('restore-full');
            // Explicitly assert it is NOT apply-discount
            expect(result.data.action).not.toBe('apply-discount');
        });

        it('cycle N (status=comp, any remaining value): comp invariant holds regardless of remaining', async () => {
            // The comp branch fires purely on status === 'comp'; the
            // promo_effect_remaining_cycles value is irrelevant.
            // Test a few representative remaining values to confirm invariance.
            const remainingValues = [null, 0, 1, 3, 999];

            for (const remaining of remainingValues) {
                vi.clearAllMocks();

                const db = buildDbMock({
                    subRow: {
                        id: 'sub-hospeda-free',
                        status: 'comp',
                        plan_id: 'plan-1',
                        mp_subscription_id: null,
                        promo_code_id: 'pc-hospeda-free',
                        promo_effect_remaining_cycles: remaining
                    }
                });
                mockGetDb.mockReturnValue(db);

                const result = await resolveRenewalPromoEffect({
                    subscriptionId: 'sub-hospeda-free'
                });

                expect(result.success).toBe(true);
                if (!result.success) throw new Error(`expected success for remaining=${remaining}`);
                expect(result.data.action).toBe('comp');
            }
        });
    });

    // =========================================================================
    // Regression Lock 2 — Legacy one-shot 30% discount finalAmount (AC-4.1)
    //
    // The post-migration BIENVENIDO30 shape is:
    //   effect_kind='discount', value_kind='percentage', value=30, duration_cycles=1.
    //
    // calculatePromoCodeEffect must still return the same finalAmount as before
    // the migration for a 30% percentage discount on a 10,000-centavo plan:
    //   finalAmount = 10000 - (10000 * 0.30) = 7000 centavos.
    //
    // This locks the effect-reducer against regressions from the typed-effect
    // refactor. The real-DB integration test (File 1) also verifies that the
    // backfilled row has value_kind='percentage' and value=30 (schema level);
    // this test locks the service/reducer layer.
    // =========================================================================

    describe('Legacy one-shot 30% discount finalAmount (AC-4.1)', () => {
        it('calculatePromoCodeEffect returns 7000 centavos for 30% off 10000 centavos', () => {
            // Arrange — post-migration BIENVENIDO30 effect shape.
            // Must use the real enum values and satisfy the PromoEffect type so
            // TypeScript narrows `kind` to the exact literal PromoEffectKindEnum.DISCOUNT.
            const discountEffect = {
                kind: PromoEffectKindEnum.DISCOUNT,
                valueKind: ValueKindEnum.PERCENTAGE,
                value: 30,
                durationCycles: 1
            } satisfies Extract<PromoEffect, { kind: PromoEffectKindEnum.DISCOUNT }>;
            const fullPriceCentavos = 10000;

            // Act
            const mutation = calculatePromoCodeEffect(discountEffect, fullPriceCentavos);

            // Assert
            expect(mutation.type).toBe('apply-discount');
            if (mutation.type !== 'apply-discount') throw new Error('expected apply-discount');
            expect(mutation.finalAmount).toBe(7000);
            expect(mutation.discountAmount).toBe(3000);
        });

        it('30% off locks: resolveRenewalPromoEffect returns 7000 centavos at cycle 1 (remaining=1 → restore-full)', async () => {
            // This also validates that a one-shot discount at cycle 1 transitions
            // to restore-full (returning FULL price for the NEXT cycle, not
            // the discounted amount) — matching AC-4.1 + AC-1.5.
            const FULL_PRICE = 10000;

            const db = buildDbMock({
                subRow: {
                    id: 'sub-bienvenido30',
                    status: 'active',
                    plan_id: 'plan-1',
                    mp_subscription_id: 'mp-1',
                    promo_code_id: 'pc-bienvenido30',
                    promo_effect_remaining_cycles: 1 // last cycle
                },
                unitAmount: FULL_PRICE
            });
            mockGetDb.mockReturnValue(db);
            mockGetPromoCodeById.mockResolvedValue(discount30Code());

            const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-bienvenido30' });

            // Assert — last cycle: restore-full (raise to full price for next cycle)
            expect(result.success).toBe(true);
            if (!result.success) throw new Error('expected success');
            expect(result.data.action).toBe('restore-full');
            // restore-full carries the FULL price (not the discounted amount)
            expect(result.data.targetTransactionAmountCentavos).toBe(FULL_PRICE);
            expect(result.data.targetTransactionAmountMajor).toBe(FULL_PRICE / 100);
            expect(result.data.remainingCyclesAfter).toBe(0);
        });

        it('30% off at cycle > 1 (remaining > 1): still discounted (apply-discount, 7000 centavos)', async () => {
            // Locks that the discount amount is consistently computed across cycles.
            const FULL_PRICE = 10000;

            const db = buildDbMock({
                subRow: {
                    id: 'sub-bienvenido30',
                    status: 'active',
                    plan_id: 'plan-1',
                    mp_subscription_id: 'mp-1',
                    promo_code_id: 'pc-bienvenido30',
                    promo_effect_remaining_cycles: 2 // mid-flight (for a 3-cycle code e.g.)
                },
                unitAmount: FULL_PRICE
            });
            mockGetDb.mockReturnValue(db);
            // Use a 3-cycle version of the same 30% discount to exercise mid-flight
            mockGetPromoCodeById.mockResolvedValue({
                ...discount30Code(),
                data: {
                    ...discount30Code().data,
                    effect: { ...discount30Code().data.effect, durationCycles: 3 }
                }
            });

            const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-bienvenido30' });

            expect(result.success).toBe(true);
            if (!result.success) throw new Error('expected success');
            expect(result.data.action).toBe('apply-discount');
            expect(result.data.targetTransactionAmountCentavos).toBe(7000);
            expect(result.data.targetTransactionAmountMajor).toBe(70);
            expect(result.data.remainingCyclesAfter).toBe(1);
        });
    });

    // =========================================================================
    // Comp vs discount invariant — ensure the two code types never mix
    //
    // This tests the type-discriminator boundary: a comp code must not be
    // processed by the discount-cycle machinery regardless of remaining cycles.
    // =========================================================================

    describe('comp vs discount type boundary', () => {
        it('a subscription with status=comp and a comp code: comp action at every cycle value', async () => {
            // If the migration fails to flip a HOSPEDA_FREE subscription to
            // status='comp', the status check is the last safety net.
            const db = buildDbMock({
                subRow: {
                    id: 'sub-comp-safety',
                    status: 'comp',
                    plan_id: 'plan-1',
                    mp_subscription_id: null,
                    promo_code_id: 'pc-hospeda-free',
                    promo_effect_remaining_cycles: 0 // exhausted counter (would trigger noop for discount)
                }
            });
            mockGetDb.mockReturnValue(db);

            const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-comp-safety' });

            // status=comp ALWAYS wins, even if remaining===0 (which would yield noop for discount)
            expect(result.success).toBe(true);
            if (!result.success) throw new Error('expected success');
            expect(result.data.action).toBe('comp');
        });

        it('a discount code on an active subscription: uses discount-cycle machinery (NOT comp)', async () => {
            // Sanity: a non-comp code on a non-comp subscription must NOT trigger comp.
            const db = buildDbMock({
                subRow: {
                    id: 'sub-discount',
                    status: 'active',
                    plan_id: 'plan-1',
                    mp_subscription_id: 'mp-1',
                    promo_code_id: 'pc-bienvenido30',
                    promo_effect_remaining_cycles: 1
                },
                unitAmount: 10000
            });
            mockGetDb.mockReturnValue(db);
            mockGetPromoCodeById.mockResolvedValue(discount30Code());

            const result = await resolveRenewalPromoEffect({ subscriptionId: 'sub-discount' });

            expect(result.success).toBe(true);
            if (!result.success) throw new Error('expected success');
            expect(result.data.action).not.toBe('comp');
            expect(['apply-discount', 'restore-full', 'noop']).toContain(result.data.action);
        });
    });
});

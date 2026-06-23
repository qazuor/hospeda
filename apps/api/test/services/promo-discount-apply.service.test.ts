/**
 * SPEC-262 T-007 — promo-discount-apply.service unit tests (fail-closed seam + B1 fix).
 *
 * Proves:
 * - FAIL-CLOSED: MP rejects → applyPromoCode NEVER called (code NOT applied).
 * - B1 fix: after MP accepts + applyPromoCode commits (which seeds N-1), the
 *   service OVERWRITES the counter to durationCycles (full N) so the existing-sub
 *   path seeds the correct value. remainingCyclesAfter = durationCycles = 3.
 * - subscription without a live preapproval → typed VALIDATION_ERROR.
 * - subscription not found → NOT_FOUND.
 *
 * DB, MercadoPago, and service-core are fully mocked — no real infra.
 *
 * @module test/services/promo-discount-apply.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (declared before importing the module under test).
// ---------------------------------------------------------------------------

const executeMock = vi.fn();
vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({ execute: executeMock })),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })
}));

vi.mock('@repo/schemas', () => ({
    PromoEffectKindEnum: { DISCOUNT: 'discount', TRIAL_EXTENSION: 'trial_extension', COMP: 'comp' }
}));

const getPromoCodeByCodeMock = vi.fn();
const calculatePromoCodeEffectMock = vi.fn();
const applyPromoCodeMock = vi.fn();
const resolveFullPlanPriceCentavosMock = vi.fn();
vi.mock('@repo/service-core', () => ({
    getPromoCodeByCode: (...args: unknown[]) => getPromoCodeByCodeMock(...args),
    calculatePromoCodeEffect: (...args: unknown[]) => calculatePromoCodeEffectMock(...args),
    applyPromoCode: (...args: unknown[]) => applyPromoCodeMock(...args),
    // S4: shared helper now exported from service-core (was local duplicate)
    resolveFullPlanPriceCentavos: (...args: unknown[]) => resolveFullPlanPriceCentavosMock(...args)
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const applyInitialDiscountMutationMock = vi.fn();
vi.mock('../../src/services/promo-renewal-mp.service', () => ({
    applyInitialDiscountMutation: (...args: unknown[]) => applyInitialDiscountMutationMock(...args)
}));

import { applyMultiCycleDiscountToExistingSubscription } from '../../src/services/promo-discount-apply.service';

/** A QZPayBilling stub — its internals are not used (MP mutation is mocked). */
const billingStub = {} as never;

const DURATION_CYCLES = 3; // finite discount: 3 cycles

/** Configure the DB execute mock: sub SELECT + price SELECT (now handled by resolveFullPlanPriceCentavos mock) + UPDATE. */
function configureDb(options: {
    subRow: Record<string, unknown> | null;
}) {
    executeMock.mockImplementation((query: { strings: TemplateStringsArray }) => {
        const text = query.strings.join(' ');
        if (text.includes('FROM billing_subscriptions')) {
            return Promise.resolve({ rows: options.subRow ? [options.subRow] : [] });
        }
        // Any other execute (e.g. the B1-fix UPDATE to overwrite the counter)
        return Promise.resolve({ rows: [] });
    });
}

describe('applyMultiCycleDiscountToExistingSubscription (fail-closed + B1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getPromoCodeByCodeMock.mockResolvedValue({
            success: true,
            data: {
                id: 'pc-1',
                effect: {
                    kind: 'discount',
                    valueKind: 'percentage',
                    value: 50,
                    durationCycles: DURATION_CYCLES
                }
            }
        });
        // S4: resolveFullPlanPriceCentavos is now the shared helper from service-core.
        resolveFullPlanPriceCentavosMock.mockResolvedValue(10000); // centavos
        calculatePromoCodeEffectMock.mockReturnValue({
            type: 'apply-discount',
            discountAmount: 5000,
            finalAmount: 5000,
            remainingCycles: DURATION_CYCLES - 1 // what applyPromoCode seeds (N-1)
        });
    });

    it('MP rejects → applyPromoCode NOT called, typed error returned (code NOT applied)', async () => {
        // Arrange
        configureDb({
            subRow: {
                id: 'sub-1',
                customer_id: 'cust-1',
                status: 'active',
                plan_id: 'plan-1',
                mp_subscription_id: 'mp-1'
            }
        });
        applyInitialDiscountMutationMock.mockResolvedValue({
            success: false,
            error: { code: 'MP_DISCOUNT_APPLY_FAILED', message: 'rejected' }
        });

        // Act
        const result = await applyMultiCycleDiscountToExistingSubscription({
            code: 'LANZAMIENTO50',
            subscriptionId: 'sub-1',
            billing: billingStub
        });

        // Assert — fail-closed: redemption never committed.
        expect(result.success).toBe(false);
        if (result.success) throw new Error('expected failure');
        expect(result.error.code).toBe('MP_DISCOUNT_APPLY_FAILED');
        expect(applyPromoCodeMock).not.toHaveBeenCalled();
    });

    it('B1: MP accepts → remainingCyclesAfter = durationCycles (full N), NOT N-1', async () => {
        // Arrange
        configureDb({
            subRow: {
                id: 'sub-1',
                customer_id: 'cust-1',
                status: 'active',
                plan_id: 'plan-1',
                mp_subscription_id: 'mp-1'
            }
        });
        applyInitialDiscountMutationMock.mockResolvedValue({ success: true });
        applyPromoCodeMock.mockResolvedValue({
            success: true,
            data: { effectKind: 'discount', remainingCycles: DURATION_CYCLES - 1 } // N-1 from reducer
        });

        // Act
        const result = await applyMultiCycleDiscountToExistingSubscription({
            code: 'LANZAMIENTO50',
            subscriptionId: 'sub-1',
            billing: billingStub
        });

        // Assert — B1 fix: counter is overwritten to full N (3), not N-1 (2).
        expect(result.success).toBe(true);
        if (!result.success) throw new Error('expected success');
        expect(result.data.discountedAmountCentavos).toBe(5000);
        // remainingCyclesAfter must be durationCycles (3), not N-1 (2).
        expect(result.data.remainingCyclesAfter).toBe(DURATION_CYCLES);
        // MP mutation happened BEFORE the redemption commit (fail-closed ordering).
        expect(applyInitialDiscountMutationMock).toHaveBeenCalledOnce();
        expect(applyPromoCodeMock).toHaveBeenCalledOnce();
        // The B1-fix UPDATE (overwrite to durationCycles) must have been issued.
        const updateCall = executeMock.mock.calls.find((c) =>
            (c[0] as { strings: TemplateStringsArray }).strings.join(' ').includes('UPDATE')
        );
        expect(updateCall).toBeDefined();
        // The UPDATE must use durationCycles (3) as the target value.
        expect((updateCall?.[0] as { values: unknown[] }).values).toContain(DURATION_CYCLES);
    });

    it('subscription without a live preapproval → VALIDATION_ERROR, no MP call', async () => {
        configureDb({
            subRow: {
                id: 'sub-1',
                customer_id: 'cust-1',
                status: 'active',
                plan_id: 'plan-1',
                mp_subscription_id: null
            }
        });

        const result = await applyMultiCycleDiscountToExistingSubscription({
            code: 'LANZAMIENTO50',
            subscriptionId: 'sub-1',
            billing: billingStub
        });

        expect(result.success).toBe(false);
        if (result.success) throw new Error('expected failure');
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(applyInitialDiscountMutationMock).not.toHaveBeenCalled();
    });

    it('subscription not found → NOT_FOUND', async () => {
        configureDb({ subRow: null });

        const result = await applyMultiCycleDiscountToExistingSubscription({
            code: 'LANZAMIENTO50',
            subscriptionId: 'missing',
            billing: billingStub
        });

        expect(result.success).toBe(false);
        if (result.success) throw new Error('expected failure');
        expect(result.error.code).toBe('NOT_FOUND');
    });
});

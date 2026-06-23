/**
 * SPEC-262 T-012 P2 — subscription-discount-signup.service unit tests.
 *
 * Proves the monthly-signup discount seam:
 *  - FAIL-CLOSED: MP rejects the lowered amount → NO DB write (no stamp, no
 *    redemption), typed error returned.
 *  - happy path: MP accepts → stamp promo_code_id + seed counter to N + record
 *    redemption; the cycle seed is N (full duration), matching the existing-sub path.
 *  - forever discount (durationCycles=null) → seed null.
 *  - computeSignupDiscountCycleSeed returns N (SANDBOX-VERIFY constant).
 *
 * DB, MercadoPago mutation, and service-core are fully mocked.
 *
 * @module test/services/subscription-discount-signup.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeMock = vi.fn();
vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({ execute: executeMock })),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })
}));

vi.mock('@repo/schemas', () => ({}));

const calculatePromoCodeEffectMock = vi.fn();
const redeemAndRecordUsageMock = vi.fn();
vi.mock('@repo/service-core', () => ({
    calculatePromoCodeEffect: (...args: unknown[]) => calculatePromoCodeEffectMock(...args),
    redeemAndRecordUsage: (...args: unknown[]) => redeemAndRecordUsageMock(...args)
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const applyInitialDiscountMutationMock = vi.fn();
vi.mock('../../src/services/promo-renewal-mp.service', () => ({
    applyInitialDiscountMutation: (...args: unknown[]) => applyInitialDiscountMutationMock(...args)
}));

import type { PromoEffect } from '@repo/schemas';
import {
    applySignupDiscountToMonthly,
    computeSignupDiscountCycleSeed
} from '../../src/services/subscription-discount-signup.service';

type DiscountEffect = Extract<PromoEffect, { kind: 'discount' }>;

const billingStub = {} as never;
const N = 3;

const baseInput = {
    billing: billingStub,
    subscriptionId: 'sub-1',
    mpSubscriptionId: 'mp-1',
    customerId: 'cust-1',
    promoCodeId: 'pc-1',
    code: 'LANZAMIENTO50',
    fullPriceCentavos: 10000,
    livemode: false
};

const finiteEffect: DiscountEffect = {
    kind: 'discount',
    valueKind: 'percentage',
    value: 50,
    durationCycles: N
} as DiscountEffect;

describe('computeSignupDiscountCycleSeed', () => {
    it('seeds N (full duration) — SANDBOX-VERIFY constant', () => {
        expect(computeSignupDiscountCycleSeed(3)).toBe(3);
        expect(computeSignupDiscountCycleSeed(1)).toBe(1);
    });
});

describe('applySignupDiscountToMonthly', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        executeMock.mockResolvedValue({ rows: [] });
        calculatePromoCodeEffectMock.mockReturnValue({
            type: 'apply-discount',
            discountAmount: 5000,
            finalAmount: 5000,
            remainingCycles: N - 1
        });
        redeemAndRecordUsageMock.mockResolvedValue({ success: true, data: {} });
    });

    it('FAIL-CLOSED: MP rejects → no DB write, no redemption, typed error', async () => {
        applyInitialDiscountMutationMock.mockResolvedValue({
            success: false,
            error: { code: 'MP_DISCOUNT_APPLY_FAILED', message: 'rejected' }
        });

        const result = await applySignupDiscountToMonthly({ ...baseInput, effect: finiteEffect });

        expect(result.success).toBe(false);
        if (result.success) throw new Error('expected failure');
        expect(result.error.code).toBe('MP_DISCOUNT_APPLY_FAILED');
        // No stamp UPDATE, no redemption — fail-closed.
        expect(executeMock).not.toHaveBeenCalled();
        expect(redeemAndRecordUsageMock).not.toHaveBeenCalled();
    });

    it('MP accepts → stamps promo + seeds counter to N + records redemption', async () => {
        applyInitialDiscountMutationMock.mockResolvedValue({ success: true });

        const result = await applySignupDiscountToMonthly({ ...baseInput, effect: finiteEffect });

        expect(result.success).toBe(true);
        if (!result.success) throw new Error('expected success');
        expect(result.data.discountedAmountCentavos).toBe(5000);
        expect(result.data.remainingCyclesSeed).toBe(N);

        // MP mutation ran BEFORE the stamp (fail-closed ordering).
        expect(applyInitialDiscountMutationMock).toHaveBeenCalledOnce();
        // Stamp UPDATE used N as the counter seed.
        const updateCall = executeMock.mock.calls.find((c) =>
            (c[0] as { strings: TemplateStringsArray }).strings.join(' ').includes('UPDATE')
        );
        expect(updateCall).toBeDefined();
        const values = (updateCall?.[0] as { values: unknown[] }).values;
        expect(values).toContain('pc-1');
        expect(values).toContain(N);
        // Redemption recorded against the sub.
        expect(redeemAndRecordUsageMock).toHaveBeenCalledOnce();
        const redeemArg = redeemAndRecordUsageMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(redeemArg.subscriptionId).toBe('sub-1');
        expect(redeemArg.discountAmount).toBe(5000);
    });

    it('forever discount (durationCycles=null) → seed null', async () => {
        applyInitialDiscountMutationMock.mockResolvedValue({ success: true });
        const foreverEffect: DiscountEffect = { ...finiteEffect, durationCycles: null };

        const result = await applySignupDiscountToMonthly({
            ...baseInput,
            effect: foreverEffect
        });

        expect(result.success).toBe(true);
        if (!result.success) throw new Error('expected success');
        expect(result.data.remainingCyclesSeed).toBeNull();
        const updateCall = executeMock.mock.calls.find((c) =>
            (c[0] as { strings: TemplateStringsArray }).strings.join(' ').includes('UPDATE')
        );
        expect((updateCall?.[0] as { values: unknown[] }).values).toContain(null);
    });
});

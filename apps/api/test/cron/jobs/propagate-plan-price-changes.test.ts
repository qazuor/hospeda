/**
 * Unit tests for the HOS-176 plan price-change propagation cron internals.
 *
 * Covers the two risk-bearing helpers with mocked collaborators (no live DB / MP):
 *   - `resolveDiscountAwareTargetCentavos` — discount-aware target amount.
 *   - `applyMpAmount` — bounded-retry MP amount mutation.
 *
 * @module test/cron/jobs/propagate-plan-price-changes
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mock handles ──────────────────────────────────────────────────
const { mockLoadDiscountState, mockGetPromoCodeById, mockCalculateEffect } = vi.hoisted(() => ({
    mockLoadDiscountState: vi.fn(),
    mockGetPromoCodeById: vi.fn(),
    mockCalculateEffect: vi.fn()
}));

vi.mock('@repo/db', () => ({
    and: vi.fn(),
    billingPlanPriceChangeTargets: {},
    billingPlanPriceChanges: {},
    billingSubscriptions: {},
    eq: vi.fn(),
    getDb: vi.fn(),
    inArray: vi.fn(),
    isNotNull: vi.fn(),
    lte: vi.fn(),
    sql: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    loadSubscriptionDiscountState: mockLoadDiscountState,
    getPromoCodeById: mockGetPromoCodeById,
    calculatePromoCodeEffect: mockCalculateEffect
}));

vi.mock('../../../src/middlewares/billing.js', () => ({ getQZPayBilling: vi.fn() }));
vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));

import { _internals } from '../../../src/cron/jobs/propagate-plan-price-changes.job.js';

const { resolveDiscountAwareTargetCentavos, applyMpAmount } = _internals;

describe('resolveDiscountAwareTargetCentavos', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the full new price when the sub has no discount', async () => {
        mockLoadDiscountState.mockResolvedValue(null);
        const r = await resolveDiscountAwareTargetCentavos('sub-1', 15000);
        expect(r).toBe(15000);
    });

    it('returns the full new price when the discount is exhausted (remaining <= 0)', async () => {
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'promo-1',
            promoEffectRemainingCycles: 0
        });
        const r = await resolveDiscountAwareTargetCentavos('sub-1', 15000);
        expect(r).toBe(15000);
        expect(mockGetPromoCodeById).not.toHaveBeenCalled();
    });

    it('applies the discount to the NEW price when the discount is active', async () => {
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'promo-1',
            promoEffectRemainingCycles: 2
        });
        mockGetPromoCodeById.mockResolvedValue({
            success: true,
            data: { effect: { kind: 'discount' } }
        });
        mockCalculateEffect.mockReturnValue({ type: 'apply-discount', finalAmount: 7500 });

        const r = await resolveDiscountAwareTargetCentavos('sub-1', 15000);
        expect(r).toBe(7500);
        // The discount is computed on the NEW full price, not a stale value.
        expect(mockCalculateEffect).toHaveBeenCalledWith({ kind: 'discount' }, 15000);
    });

    it('falls open to the full new price when discount resolution throws', async () => {
        mockLoadDiscountState.mockRejectedValue(new Error('db down'));
        const r = await resolveDiscountAwareTargetCentavos('sub-1', 15000);
        expect(r).toBe(15000);
    });
});

describe('applyMpAmount', () => {
    function makeBilling(updateImpl: () => Promise<void>): QZPayBilling {
        return {
            getPaymentAdapter: () => ({
                subscriptions: { update: vi.fn(updateImpl) }
            })
        } as unknown as QZPayBilling;
    }

    it('returns ok on the first successful update', async () => {
        const billing = makeBilling(async () => undefined);
        const r = await applyMpAmount(billing, 'mp-1', 120);
        expect(r).toEqual({ ok: true });
    });

    it('returns an error when the adapter is unavailable', async () => {
        const billing = { getPaymentAdapter: () => null } as unknown as QZPayBilling;
        const r = await applyMpAmount(billing, 'mp-1', 120);
        expect(r).toEqual({ ok: false, error: 'MP payment adapter unavailable' });
    });

    it('retries then returns the last error when all attempts fail', async () => {
        const update = vi.fn(async () => {
            throw new Error('MP 429');
        });
        const billing = {
            getPaymentAdapter: () => ({ subscriptions: { update } })
        } as unknown as QZPayBilling;

        const r = await applyMpAmount(billing, 'mp-1', 120);
        expect(r).toEqual({ ok: false, error: 'MP 429' });
        expect(update).toHaveBeenCalledTimes(_internals.MP_UPDATE_MAX_ATTEMPTS);
    });
});

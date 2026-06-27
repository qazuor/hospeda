/**
 * SPEC-262 T-007 — promo-renewal-mp.service unit tests.
 *
 * Covers the API-side MercadoPago amount-mutation executors:
 *
 * - applyInitialDiscountMutation (FAIL-CLOSED):
 *   - MP accepts → success
 *   - MP rejects → typed error (caller must NOT mark code applied)
 *   - adapter unavailable → typed error
 *
 * - restoreFullPriceMutation (BEST-EFFORT WITH RETRY):
 *   - MP accepts first try → success
 *   - MP rejects then accepts → success after retry
 *   - MP rejects every attempt → typed error + Sentry capture, never throws
 *
 * MercadoPago + Sentry are fully mocked — no real MP, no real Sentry.
 *
 * @module test/services/promo-renewal-mp.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

import * as Sentry from '@sentry/node';
import {
    applyInitialDiscountMutation,
    restoreFullPriceMutation
} from '../../src/services/promo-renewal-mp.service';

/**
 * Build a mock QZPayBilling whose payment adapter's
 * `subscriptions.update` resolves/rejects according to `updateImpl`.
 */
function buildBilling(updateImpl: ReturnType<typeof vi.fn> | null) {
    if (updateImpl === null) {
        return { getPaymentAdapter: vi.fn(() => null) } as never;
    }
    return {
        getPaymentAdapter: vi.fn(() => ({
            subscriptions: { update: updateImpl }
        }))
    } as never;
}

describe('applyInitialDiscountMutation (fail-closed)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('MP accepts the discounted amount → success', async () => {
        // Arrange
        const update = vi.fn().mockResolvedValue(undefined);
        const billing = buildBilling(update);

        // Act
        const result = await applyInitialDiscountMutation({
            billing,
            mpSubscriptionId: 'mp-1',
            targetTransactionAmountMajor: 50,
            subscriptionId: 'sub-1'
        });

        // Assert
        expect(result.success).toBe(true);
        expect(update).toHaveBeenCalledWith('mp-1', { transactionAmount: 50 });
    });

    it('MP rejects → typed error (code NOT applied)', async () => {
        // Arrange
        const update = vi.fn().mockRejectedValue(new Error('amount too high'));
        const billing = buildBilling(update);

        // Act
        const result = await applyInitialDiscountMutation({
            billing,
            mpSubscriptionId: 'mp-1',
            targetTransactionAmountMajor: 50,
            subscriptionId: 'sub-1'
        });

        // Assert
        expect(result.success).toBe(false);
        if (result.success) throw new Error('expected failure');
        expect(result.error.code).toBe('MP_DISCOUNT_APPLY_FAILED');
    });

    it('adapter unavailable → typed error', async () => {
        const billing = buildBilling(null);
        const result = await applyInitialDiscountMutation({
            billing,
            mpSubscriptionId: 'mp-1',
            targetTransactionAmountMajor: 50,
            subscriptionId: 'sub-1'
        });
        expect(result.success).toBe(false);
        if (result.success) throw new Error('expected failure');
        expect(result.error.code).toBe('MP_ADAPTER_UNAVAILABLE');
    });
});

describe('restoreFullPriceMutation (best-effort with retry)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('MP accepts on first attempt → success', async () => {
        const update = vi.fn().mockResolvedValue(undefined);
        const billing = buildBilling(update);

        const result = await restoreFullPriceMutation({
            billing,
            mpSubscriptionId: 'mp-1',
            targetTransactionAmountMajor: 100,
            subscriptionId: 'sub-1'
        });

        expect(result.success).toBe(true);
        expect(update).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith('mp-1', { transactionAmount: 100 });
    });

    it('MP rejects once then accepts → success after retry', async () => {
        const update = vi
            .fn()
            .mockRejectedValueOnce(new Error('transient'))
            .mockResolvedValueOnce(undefined);
        const billing = buildBilling(update);

        const result = await restoreFullPriceMutation({
            billing,
            mpSubscriptionId: 'mp-1',
            targetTransactionAmountMajor: 100,
            subscriptionId: 'sub-1'
        });

        expect(result.success).toBe(true);
        expect(update).toHaveBeenCalledTimes(2);
    });

    it('MP rejects every attempt → typed error + Sentry, never throws', async () => {
        const update = vi.fn().mockRejectedValue(new Error('mp down'));
        const billing = buildBilling(update);

        const result = await restoreFullPriceMutation({
            billing,
            mpSubscriptionId: 'mp-1',
            targetTransactionAmountMajor: 100,
            subscriptionId: 'sub-1'
        });

        expect(result.success).toBe(false);
        if (result.success) throw new Error('expected failure');
        expect(result.error.code).toBe('MP_RESTORE_FAILED');
        // 3 attempts (1 + 2 retries)
        expect(update).toHaveBeenCalledTimes(3);
        expect(Sentry.captureException).toHaveBeenCalledOnce();
    });
});

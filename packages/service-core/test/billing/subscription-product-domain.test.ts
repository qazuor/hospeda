/**
 * HOS-75 T-002 — loadSubscriptionDiscountState() unit tests.
 *
 * Verifies the new shared typed helper that replaces 4 near-identical raw-SQL
 * SELECTs (payment-logic.ts, dunning.job.ts, apply-scheduled-plan-changes.ts,
 * promo-code.renewal.ts) with a single typed Drizzle query.
 *
 * No DB, no network — all mocked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', () => ({
    billingSubscriptions: {
        id: 'id',
        status: 'status',
        planId: 'planId',
        mpSubscriptionId: 'mpSubscriptionId',
        promoCodeId: 'promoCodeId',
        promoEffectRemainingCycles: 'promoEffectRemainingCycles'
    },
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
    getDb: vi.fn()
}));

import * as dbModule from '@repo/db';
import { loadSubscriptionDiscountState } from '../../src/services/billing/subscription/subscription-product-domain.js';

const mockGetDb = dbModule.getDb as ReturnType<typeof vi.fn>;

describe('loadSubscriptionDiscountState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the typed discount-state row when the subscription exists', async () => {
        // Arrange
        const row = {
            id: 'sub-1',
            status: 'active',
            planId: 'plan-1',
            mpSubscriptionId: 'mp-1',
            promoCodeId: 'promo-1',
            promoEffectRemainingCycles: 3
        };
        mockGetDb.mockReturnValue({
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([row])
                    })
                })
            })
        });

        // Act
        const result = await loadSubscriptionDiscountState({ subscriptionId: 'sub-1' });

        // Assert
        expect(result).toEqual(row);
    });

    it('returns null when no subscription row is found', async () => {
        // Arrange
        mockGetDb.mockReturnValue({
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            })
        });

        // Act
        const result = await loadSubscriptionDiscountState({ subscriptionId: 'missing-sub' });

        // Assert
        expect(result).toBeNull();
    });

    it('queries a single row (limit 1) filtered by the given subscription id', async () => {
        // Arrange
        const limitMock = vi.fn().mockResolvedValue([]);
        const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
        const fromMock = vi.fn().mockReturnValue({ where: whereMock });
        const selectMock = vi.fn().mockReturnValue({ from: fromMock });
        mockGetDb.mockReturnValue({ select: selectMock });

        // Act
        await loadSubscriptionDiscountState({ subscriptionId: 'sub-42' });

        // Assert
        expect(limitMock).toHaveBeenCalledWith(1);
        expect(whereMock).toHaveBeenCalledTimes(1);
        expect(selectMock).toHaveBeenCalledTimes(1);
    });

    it('null promoCodeId / promoEffectRemainingCycles pass through unchanged (no discount active)', async () => {
        // Arrange
        const row = {
            id: 'sub-2',
            status: 'active',
            planId: 'plan-2',
            mpSubscriptionId: null,
            promoCodeId: null,
            promoEffectRemainingCycles: null
        };
        mockGetDb.mockReturnValue({
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([row])
                    })
                })
            })
        });

        // Act
        const result = await loadSubscriptionDiscountState({ subscriptionId: 'sub-2' });

        // Assert
        expect(result).toEqual(row);
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock external dependencies before importing the module under test
vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn(),
    getPlanBySlug: vi.fn()
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        customerId: 'customerId',
        status: 'status',
        deletedAt: 'deletedAt'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
    isNull: vi.fn((col: unknown) => ({ col, isNull: true }))
}));

import { getAddonBySlug, getPlanBySlug } from '@repo/billing';
import { recalculateAddonLimitsForCustomer } from '../../src/services/billing/addon/addon-limit-recalculation.service.js';

const mockGetAddonBySlug = getAddonBySlug as ReturnType<typeof vi.fn>;
const mockGetPlanBySlug = getPlanBySlug as ReturnType<typeof vi.fn>;

/** Build a minimal mock DrizzleClient for select queries */
function buildMockDb(purchases: unknown[]) {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(purchases)
            })
        })
    };
}

/** Build a minimal mock QZPay billing client */
function buildMockBilling(
    subscriptions: unknown[],
    overrides: {
        setFn?: ReturnType<typeof vi.fn>;
        removeBySourceFn?: ReturnType<typeof vi.fn>;
    } = {}
) {
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(subscriptions)
        },
        limits: {
            set: overrides.setFn ?? vi.fn().mockResolvedValue(undefined),
            removeBySource: overrides.removeBySourceFn ?? vi.fn().mockResolvedValue(undefined)
        }
    };
}

describe('recalculateAddonLimitsForCustomer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return failed outcome when customer has no subscriptions', async () => {
        // Arrange
        const db = buildMockDb([]);
        const billing = buildMockBilling([]);

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: db as never
        });

        // Assert
        expect(result.outcome).toBe('failed');
        expect(result.reason).toMatch(/no subscriptions/i);
    });

    it('should return failed outcome when customer has no active subscription', async () => {
        // Arrange
        const db = buildMockDb([]);
        const billing = buildMockBilling([{ status: 'cancelled', planId: 'starter' }]);

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: db as never
        });

        // Assert
        expect(result.outcome).toBe('failed');
        expect(result.reason).toMatch(/no active/i);
    });

    it('should return failed outcome when plan is not found in canonical config', async () => {
        // Arrange
        const db = buildMockDb([]);
        const billing = buildMockBilling([{ status: 'active', planId: 'unknown-plan' }]);
        mockGetPlanBySlug.mockReturnValue(undefined);

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: db as never
        });

        // Assert
        expect(result.outcome).toBe('failed');
        expect(result.reason).toMatch(/unknown-plan/);
    });

    it('should return skipped outcome when base plan has unlimited (-1) for the limitKey', async () => {
        // Arrange
        const db = buildMockDb([]);
        const billing = buildMockBilling([{ status: 'active', planId: 'enterprise' }]);
        mockGetPlanBySlug.mockReturnValue({
            limits: [{ key: 'max_accommodations', value: -1 }]
        });

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: db as never
        });

        // Assert
        expect(result.outcome).toBe('skipped');
        expect(result.newMaxValue).toBe(-1);
    });

    it('should call billing.limits.set when there are active addon increments', async () => {
        // Arrange
        const mockSet = vi.fn().mockResolvedValue(undefined);
        const purchases = [
            {
                addonSlug: 'extra-listings',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 10 }]
            }
        ];
        const db = buildMockDb(purchases);
        const billing = buildMockBilling([{ status: 'active', planId: 'starter' }], {
            setFn: mockSet
        });
        mockGetAddonBySlug.mockReturnValue({ affectsLimitKey: 'max_accommodations' });
        mockGetPlanBySlug.mockReturnValue({
            limits: [{ key: 'max_accommodations', value: 5 }]
        });

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: db as never
        });

        // Assert
        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(15); // base(5) + addon(10)
        expect(result.addonCount).toBe(1);
        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 'cust-1',
                limitKey: 'max_accommodations',
                maxValue: 15
            })
        );
    });

    it('should call billing.limits.removeBySource when no addons contribute to the limitKey', async () => {
        // Arrange — addon exists but does not affect this limitKey
        const mockRemoveBySource = vi.fn().mockResolvedValue(undefined);
        const purchases = [
            {
                addonSlug: 'extra-photos',
                status: 'active',
                deletedAt: null,
                limitAdjustments: []
            }
        ];
        const db = buildMockDb(purchases);
        const billing = buildMockBilling([{ status: 'active', planId: 'starter' }], {
            removeBySourceFn: mockRemoveBySource
        });
        mockGetAddonBySlug.mockReturnValue({ affectsLimitKey: 'max_photos' }); // different key
        mockGetPlanBySlug.mockReturnValue({
            limits: [{ key: 'max_accommodations', value: 5 }]
        });

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: db as never
        });

        // Assert
        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(5); // only base plan
        expect(mockRemoveBySource).toHaveBeenCalled();
    });

    it('should return failed outcome when an unexpected error is thrown', async () => {
        // Arrange
        const db = {
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockRejectedValue(new Error('unexpected db crash'))
                })
            })
        };
        const billing = buildMockBilling([]);

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: db as never
        });

        // Assert
        expect(result.outcome).toBe('failed');
        expect(result.reason).toMatch(/unexpected error/i);
    });

    it('should handle trialing subscription as active', async () => {
        // Arrange
        const mockSet = vi.fn().mockResolvedValue(undefined);
        const db = buildMockDb([]);
        const billing = buildMockBilling([{ status: 'trialing', planId: 'starter' }], {
            setFn: mockSet
        });
        mockGetPlanBySlug.mockReturnValue({
            limits: [{ key: 'max_accommodations', value: 3 }]
        });

        // Act
        const result = await recalculateAddonLimitsForCustomer({
            customerId: 'cust-1',
            limitKey: 'max_accommodations',
            billing: billing as never,
            db: db as never
        });

        // Assert — no addons, so removeBySource is called but outcome is still success
        expect(result.outcome).toBe('success');
        expect(result.newMaxValue).toBe(3);
    });
});

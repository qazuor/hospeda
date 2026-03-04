/**
 * Unit tests for the plan change interval mapping fix.
 *
 * Tests cover:
 * - Correct interval mapping for all BillingIntervalEnum values
 * - intervalCount for quarterly (3) and semi_annual (6)
 * - Price lookup with interval + intervalCount matching
 *
 * @module test/routes/plan-change-interval
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    billingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock route infrastructure to avoid deep dependency chains
vi.mock('../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../src/utils/route-factory', () => ({
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler),
    createAdminRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

// ---------------------------------------------------------------------------
// We need to test the mapBillingIntervalToQZPay function indirectly
// since it's not exported. We test via handlePlanChange integration.
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../src/middlewares/billing';
import { handlePlanChange } from '../../src/routes/billing/plan-change';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(
    options: {
        billingEnabled?: boolean;
        billingCustomerId?: string | null;
        body?: unknown;
    } = {}
) {
    const {
        billingEnabled = true,
        billingCustomerId = 'cust_123',
        body = { newPlanId: 'plan_pro', billingInterval: 'monthly' }
    } = options;

    const contextStore = new Map<string, unknown>([
        ['billingEnabled', billingEnabled],
        ['billingCustomerId', billingCustomerId]
    ]);

    return {
        get: vi.fn((key: string) => contextStore.get(key)),
        req: {
            json: vi.fn().mockResolvedValue(body)
        }
    };
}

function createBillingMock(
    options: {
        currentPlanPrices?: Array<{
            id: string;
            billingInterval: string;
            unitAmount: number;
            intervalCount?: number;
        }>;
        targetPlanPrices?: Array<{
            id: string;
            billingInterval: string;
            unitAmount: number;
            intervalCount?: number;
        }>;
        activeSubPlanId?: string;
        activeSubInterval?: string;
    } = {}
) {
    const {
        currentPlanPrices = [{ id: 'price_1', billingInterval: 'month', unitAmount: 1000 }],
        targetPlanPrices = [{ id: 'price_2', billingInterval: 'month', unitAmount: 2000 }],
        activeSubPlanId = 'plan_basic',
        activeSubInterval = 'month'
    } = options;

    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([
                {
                    id: 'sub_1',
                    planId: activeSubPlanId,
                    status: 'active',
                    interval: activeSubInterval
                }
            ]),
            changePlan: vi.fn().mockResolvedValue({
                subscription: { id: 'sub_1' },
                proration: {
                    effectiveDate: new Date('2026-03-01'),
                    chargeAmount: 500,
                    creditAmount: 0
                }
            })
        },
        plans: {
            get: vi.fn().mockImplementation((planId: string) => {
                if (planId === activeSubPlanId) {
                    return Promise.resolve({ id: activeSubPlanId, prices: currentPlanPrices });
                }
                return Promise.resolve({ id: 'plan_pro', prices: targetPlanPrices });
            })
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('plan-change interval mapping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should match monthly prices correctly (intervalCount=1)', async () => {
        // Arrange
        const billing = createBillingMock({
            targetPlanPrices: [
                {
                    id: 'price_monthly',
                    billingInterval: 'month',
                    unitAmount: 2000,
                    intervalCount: 1
                }
            ]
        });
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const ctx = createMockContext({
            body: { newPlanId: 'plan_pro', billingInterval: 'monthly' }
        });

        // Act
        const _result = await handlePlanChange(ctx as never);

        // Assert
        expect(billing.subscriptions.changePlan).toHaveBeenCalledWith(
            'sub_1',
            expect.objectContaining({
                newPriceId: 'price_monthly'
            })
        );
    });

    it('should match quarterly prices with intervalCount=3', async () => {
        // Arrange
        const billing = createBillingMock({
            targetPlanPrices: [
                {
                    id: 'price_monthly',
                    billingInterval: 'month',
                    unitAmount: 2000,
                    intervalCount: 1
                },
                {
                    id: 'price_quarterly',
                    billingInterval: 'month',
                    unitAmount: 5000,
                    intervalCount: 3
                }
            ]
        });
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const ctx = createMockContext({
            body: { newPlanId: 'plan_pro', billingInterval: 'quarterly' }
        });

        // Act
        const _result = await handlePlanChange(ctx as never);

        // Assert
        expect(billing.subscriptions.changePlan).toHaveBeenCalledWith(
            'sub_1',
            expect.objectContaining({
                newPriceId: 'price_quarterly'
            })
        );
    });

    it('should match semi_annual prices with intervalCount=6', async () => {
        // Arrange
        const billing = createBillingMock({
            targetPlanPrices: [
                {
                    id: 'price_monthly',
                    billingInterval: 'month',
                    unitAmount: 2000,
                    intervalCount: 1
                },
                { id: 'price_semi', billingInterval: 'month', unitAmount: 9000, intervalCount: 6 }
            ]
        });
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const ctx = createMockContext({
            body: { newPlanId: 'plan_pro', billingInterval: 'semi_annual' }
        });

        // Act
        const _result = await handlePlanChange(ctx as never);

        // Assert
        expect(billing.subscriptions.changePlan).toHaveBeenCalledWith(
            'sub_1',
            expect.objectContaining({
                newPriceId: 'price_semi'
            })
        );
    });

    it('should match annual prices correctly', async () => {
        // Arrange
        const billing = createBillingMock({
            targetPlanPrices: [
                { id: 'price_annual', billingInterval: 'year', unitAmount: 20000, intervalCount: 1 }
            ]
        });
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const ctx = createMockContext({
            body: { newPlanId: 'plan_pro', billingInterval: 'annual' }
        });

        // Act
        const _result = await handlePlanChange(ctx as never);

        // Assert
        expect(billing.subscriptions.changePlan).toHaveBeenCalledWith(
            'sub_1',
            expect.objectContaining({
                newPriceId: 'price_annual'
            })
        );
    });

    it('should throw 400 when no price matches the interval+count', async () => {
        // Arrange - only monthly prices, but requesting quarterly
        const billing = createBillingMock({
            targetPlanPrices: [
                {
                    id: 'price_monthly',
                    billingInterval: 'month',
                    unitAmount: 2000,
                    intervalCount: 1
                }
            ]
        });
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const ctx = createMockContext({
            body: { newPlanId: 'plan_pro', billingInterval: 'quarterly' }
        });

        // Act & Assert
        await expect(handlePlanChange(ctx as never)).rejects.toThrow('No price found');
    });

    it('should reject invalid billing interval at schema validation level', async () => {
        // Arrange - 'biweekly' is not in BillingIntervalEnum, so Zod rejects it
        const billing = createBillingMock();
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const ctx = createMockContext({
            body: { newPlanId: 'plan_pro', billingInterval: 'biweekly' }
        });

        // Act & Assert - Zod schema validation rejects before reaching interval mapping
        await expect(handlePlanChange(ctx as never)).rejects.toThrow('Invalid request body');
    });

    it('should default intervalCount to 1 when price has no intervalCount', async () => {
        // Arrange - price without intervalCount field (legacy data)
        const billing = createBillingMock({
            targetPlanPrices: [
                { id: 'price_monthly', billingInterval: 'month', unitAmount: 2000 }
                // No intervalCount field
            ]
        });
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const ctx = createMockContext({
            body: { newPlanId: 'plan_pro', billingInterval: 'monthly' }
        });

        // Act
        const _result = await handlePlanChange(ctx as never);

        // Assert - should match because (undefined ?? 1) === 1
        expect(billing.subscriptions.changePlan).toHaveBeenCalledWith(
            'sub_1',
            expect.objectContaining({
                newPriceId: 'price_monthly'
            })
        );
    });
});

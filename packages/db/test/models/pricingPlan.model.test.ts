import type { BillingIntervalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { PricingPlanModel } from '../../src/models/catalog/pricingPlan.model';

// Infer the type from the database schema
type PricingPlan = typeof import(
    '../../src/schemas/catalog/pricingPlan.dbschema'
).pricingPlans.$inferSelect;

const mockPricingPlan: PricingPlan = {
    id: 'plan-1',
    productId: 'product-1',
    billingScheme: 'RECURRING',
    interval: 'MONTH',
    amountMinor: 2000,
    currency: 'USD',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'user-1',
    updatedById: 'user-1',
    deletedAt: null,
    deletedById: null,
    adminInfo: null
};

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('PricingPlanModel', () => {
    let pricingPlanModel: PricingPlanModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        pricingPlanModel = new PricingPlanModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            expect(pricingPlanModel.getTableName()).toBe('pricing_plans');
        });
    });

    describe('calculateTotal', () => {
        it('should calculate total for pricing plan', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockPricingPlan])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingPlanModel.calculateTotal(mockPricingPlan.id, 3);

            expect(result).toBeDefined();
            expect(result.total).toBe(6000); // 2000 * 3
            expect(result.currency).toBe('USD');
            expect(result.quantity).toBe(3);
            expect(result.billingInterval).toBe('MONTH');
        });
    });

    describe('getApplicableTiers', () => {
        it('should get applicable pricing tiers for a plan', async () => {
            const mockTier = {
                id: 'tier-1',
                pricingPlanId: mockPricingPlan.id,
                minQuantity: 1,
                maxQuantity: 10,
                unitPriceMinor: 1800
            };

            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue([mockTier])
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingPlanModel.getApplicableTiers(mockPricingPlan.id, 5);

            expect(result).toBeDefined();
            expect(result.length).toBe(1);
            expect(result[0].unitPriceMinor).toBe(1800);
        });
    });

    describe('validateQuantity', () => {
        it('should validate quantity', async () => {
            const result = await pricingPlanModel.validateQuantity(mockPricingPlan.id, 5);

            expect(result).toBeDefined();
            expect(result.isValid).toBe(true);
            expect(result.quantity).toBe(5);
        });

        it('should reject invalid quantity', async () => {
            const result = await pricingPlanModel.validateQuantity(mockPricingPlan.id, 0);

            expect(result).toBeDefined();
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('findByProduct', () => {
        it('should find pricing plans by product ID', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockPricingPlan])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingPlanModel.findByProduct('product-1');

            expect(result).toBeDefined();
            expect(result.length).toBe(1);
            expect(result[0].productId).toBe('product-1');
        });
    });

    describe('findRecurring', () => {
        it('should find recurring plans by interval', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([mockPricingPlan])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingPlanModel.findRecurring('MONTH' as BillingIntervalEnum);

            expect(result).toBeDefined();
            expect(result.length).toBe(1);
            expect(result[0].interval).toBe('MONTH');
        });
    });

    describe('findOneTime', () => {
        it('should find one-time billing plans', async () => {
            const oneTimePlan = { ...mockPricingPlan, billingScheme: 'ONE_TIME', interval: null };
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([oneTimePlan])
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingPlanModel.findOneTime();

            expect(result).toBeDefined();
            expect(result.length).toBe(1);
            expect(result[0].billingScheme).toBe('ONE_TIME');
        });
    });

    describe('withTiers', () => {
        it('should find plans with their pricing tiers', async () => {
            const planWithTiers = {
                ...mockPricingPlan,
                pricingTiers: [
                    { id: 'tier-1', minQuantity: 1, maxQuantity: 10, unitPriceMinor: 1800 }
                ]
            };

            const mockDb = {
                query: {
                    pricingPlans: {
                        findMany: vi.fn().mockResolvedValue([planWithTiers])
                    }
                }
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingPlanModel.withTiers();

            expect(result).toBeDefined();
            expect(result.length).toBe(1);
            expect(result[0].pricingTiers).toBeDefined();
            expect(result[0].pricingTiers.length).toBe(1);
        });
    });

    describe('getUsageStats', () => {
        it('should get usage statistics for a plan', async () => {
            const result = await pricingPlanModel.getUsageStats(mockPricingPlan.id);

            expect(result).toBeDefined();
            expect(result.planId).toBe(mockPricingPlan.id);
            expect(result.totalSubscriptions).toBe(0);
            expect(result.activeSubscriptions).toBe(0);
            expect(result.totalRevenue).toBe(0);
        });
    });
});

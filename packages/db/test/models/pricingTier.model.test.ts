import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { PricingTierModel } from '../../src/models/catalog/pricingTier.model';

// Infer the type from the database schema
type PricingTier = typeof import(
    '../../src/schemas/catalog/pricingTier.dbschema'
).pricingTiers.$inferSelect;

const mockPricingTier: PricingTier = {
    id: 'tier-1',
    pricingPlanId: 'plan-1',
    minQuantity: 1,
    maxQuantity: 10,
    unitPriceMinor: 1800,
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

describe('PricingTierModel', () => {
    let pricingTierModel: PricingTierModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        pricingTierModel = new PricingTierModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            expect(pricingTierModel.getTableName()).toBe('pricing_tiers');
        });
    });

    describe('findApplicableTier', () => {
        it('should find the applicable tier for a given quantity', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([mockPricingTier])
                            })
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingTierModel.findApplicableTier('plan-1', 5);

            expect(result).toBeDefined();
            expect(result?.id).toBe('tier-1');
            expect(result?.unitPriceMinor).toBe(1800);
        });

        it('should return null if no applicable tier found', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([])
                            })
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingTierModel.findApplicableTier('plan-1', 50);

            expect(result).toBeNull();
        });
    });

    describe('calculatePrice', () => {
        it('should calculate price using tier pricing', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([mockPricingTier])
                            })
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingTierModel.calculatePrice('plan-1', 5);

            expect(result).toBeDefined();
            expect(result.totalPrice).toBe(9000); // 1800 * 5
            expect(result.unitPrice).toBe(1800);
            expect(result.quantity).toBe(5);
            expect(result.tier).toBeDefined();
        });

        it('should return null when no applicable tier', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([])
                            })
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingTierModel.calculatePrice('plan-1', 50);

            expect(result).toBeNull();
        });
    });

    describe('validateRanges', () => {
        it('should validate tier ranges for a plan', async () => {
            const tiersWithGaps = [
                { ...mockPricingTier, minQuantity: 1, maxQuantity: 5 },
                { ...mockPricingTier, id: 'tier-2', minQuantity: 10, maxQuantity: 20 } // Gap between 5 and 10
            ];

            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(tiersWithGaps)
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingTierModel.validateRanges('plan-1');

            expect(result).toBeDefined();
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Gap found between tier ranges: 5 to 10');
        });

        it('should validate overlapping ranges', async () => {
            const overlappingTiers = [
                { ...mockPricingTier, minQuantity: 1, maxQuantity: 10 },
                { ...mockPricingTier, id: 'tier-2', minQuantity: 8, maxQuantity: 15 } // Overlap
            ];

            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(overlappingTiers)
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingTierModel.validateRanges('plan-1');

            expect(result).toBeDefined();
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should validate continuous valid ranges', async () => {
            const validTiers = [
                { ...mockPricingTier, minQuantity: 1, maxQuantity: 10 },
                { ...mockPricingTier, id: 'tier-2', minQuantity: 11, maxQuantity: 20 },
                { ...mockPricingTier, id: 'tier-3', minQuantity: 21, maxQuantity: null }
            ];

            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(validTiers)
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingTierModel.validateRanges('plan-1');

            expect(result).toBeDefined();
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('checkOverlaps', () => {
        it('should check for overlapping tiers', async () => {
            const overlappingTiers = [
                { ...mockPricingTier, minQuantity: 1, maxQuantity: 10 },
                { ...mockPricingTier, id: 'tier-2', minQuantity: 5, maxQuantity: 15 }
            ];

            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(overlappingTiers)
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingTierModel.checkOverlaps('plan-1');

            expect(result).toBeDefined();
            expect(result.hasOverlaps).toBe(true);
            expect(result.overlaps.length).toBeGreaterThan(0);
        });
    });

    describe('getTierForQuantity', () => {
        it('should get the best tier for a specific quantity', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([mockPricingTier])
                            })
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingTierModel.getTierForQuantity('plan-1', 5);

            expect(result).toBeDefined();
            expect(result?.unitPriceMinor).toBe(1800);
        });
    });

    describe('calculateSavings', () => {
        it('should calculate savings compared to base price', async () => {
            const basePlan = { amountMinor: 2000 };
            const mockDbForPlan = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([basePlan])
                    })
                })
            };
            const mockDbForTier = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([mockPricingTier])
                            })
                        })
                    })
                })
            };

            getDb.mockReturnValueOnce(mockDbForPlan).mockReturnValueOnce(mockDbForTier);

            const result = await pricingTierModel.calculateSavings('plan-1', 5);

            expect(result).toBeDefined();
            expect(result.baseTotalPrice).toBe(10000); // 2000 * 5
            expect(result.tierTotalPrice).toBe(9000); // 1800 * 5
            expect(result.savingsAmount).toBe(1000);
            expect(result.savingsPercentage).toBe(10);
        });
    });

    describe('findByPlan', () => {
        it('should find all tiers for a pricing plan', async () => {
            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue([mockPricingTier])
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingTierModel.findByPlan('plan-1');

            expect(result).toBeDefined();
            expect(result.length).toBe(1);
            expect(result[0].pricingPlanId).toBe('plan-1');
        });
    });

    describe('validateTierStructure', () => {
        it('should validate the overall tier structure', async () => {
            const validTiers = [
                { ...mockPricingTier, minQuantity: 1, maxQuantity: 10 },
                { ...mockPricingTier, id: 'tier-2', minQuantity: 11, maxQuantity: null }
            ];

            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(validTiers)
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingTierModel.validateTierStructure('plan-1');

            expect(result).toBeDefined();
            expect(result.isValid).toBe(true);
            expect(result.hasProperCoverage).toBe(true);
            expect(result.hasOverlaps).toBe(false);
        });
    });

    describe('getOptimalTier', () => {
        it('should get the optimal tier for volume pricing', async () => {
            const tiers = [
                { ...mockPricingTier, minQuantity: 1, maxQuantity: 10, unitPriceMinor: 2000 },
                {
                    ...mockPricingTier,
                    id: 'tier-2',
                    minQuantity: 11,
                    maxQuantity: 50,
                    unitPriceMinor: 1800
                },
                {
                    ...mockPricingTier,
                    id: 'tier-3',
                    minQuantity: 51,
                    maxQuantity: null,
                    unitPriceMinor: 1500
                }
            ];

            const mockDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([tiers[2]]) // Return the tier with lowest price
                            })
                        })
                    })
                })
            };
            getDb.mockReturnValue(mockDb);

            const result = await pricingTierModel.getOptimalTier('plan-1', 100);

            expect(result).toBeDefined();
            expect(result?.unitPriceMinor).toBe(1500); // Lowest price tier for high volume
        });
    });
});

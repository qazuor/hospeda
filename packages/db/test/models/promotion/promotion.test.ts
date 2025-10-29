import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromotionModel } from '../../../src/models/promotion/promotion.model';
import type { Promotion } from '../../../src/schemas/promotion/promotion.dbschema';

vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

// Create a comprehensive mock for the database query builder
const createQueryMock = (defaultResult: any[] = []) => {
    // Create a special mock for count queries that can be awaited directly
    const awaitableWithMethods = Object.assign(Promise.resolve(defaultResult), {
        orderBy: vi.fn().mockReturnValue(
            Object.assign(Promise.resolve(defaultResult), {
                limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(defaultResult)
                }),
                offset: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(defaultResult)
                })
            })
        ),
        limit: vi.fn().mockResolvedValue(defaultResult)
    });

    return {
        from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(awaitableWithMethods),
            orderBy: vi.fn().mockReturnValue(
                Object.assign(Promise.resolve(defaultResult), {
                    limit: vi.fn().mockReturnValue({
                        offset: vi.fn().mockResolvedValue(defaultResult)
                    }),
                    offset: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue(defaultResult)
                    })
                })
            ),
            leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue(awaitableWithMethods),
                orderBy: vi.fn().mockReturnValue(
                    Object.assign(Promise.resolve(defaultResult), {
                        limit: vi.fn().mockReturnValue({
                            offset: vi.fn().mockResolvedValue(defaultResult)
                        })
                    })
                )
            })
        }),
        where: vi.fn().mockReturnValue(awaitableWithMethods),
        orderBy: vi.fn().mockReturnValue(
            Object.assign(Promise.resolve(defaultResult), {
                limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(defaultResult)
                }),
                offset: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(defaultResult)
                })
            })
        ),
        leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(awaitableWithMethods),
            orderBy: vi.fn().mockReturnValue(
                Object.assign(Promise.resolve(defaultResult), {
                    limit: vi.fn().mockReturnValue({
                        offset: vi.fn().mockResolvedValue(defaultResult)
                    })
                })
            )
        }),
        limit: vi.fn().mockResolvedValue(defaultResult)
    };
};

const mockDb = {
    insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
            returning: vi.fn()
        })
    }),
    update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
                returning: vi.fn()
            })
        })
    }),
    delete: vi.fn().mockReturnValue({
        where: vi.fn()
    }),
    select: vi.fn().mockImplementation(() => createQueryMock()),
    from: vi.fn()
};

vi.mock('../../../src/client', () => ({
    getDb: vi.fn(() => mockDb)
}));

// Mock data
const mockPromotion: Promotion = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Summer Sale',
    rules: JSON.stringify({ discountPercent: 20 }),
    startsAt: new Date('2023-01-01T00:00:00Z'),
    endsAt: new Date('2025-12-31T23:59:59Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    createdById: '550e8400-e29b-41d4-a716-446655440000',
    updatedById: '550e8400-e29b-41d4-a716-446655440000',
    deletedAt: null,
    deletedById: null,
    adminInfo: null
};

describe('PromotionModel', () => {
    let promotionModel: PromotionModel;

    beforeEach(() => {
        promotionModel = new PromotionModel();
        vi.clearAllMocks();

        // Reset the select mock to its default implementation
        mockDb.select.mockImplementation(() => createQueryMock());
    });

    it('should create instance', () => {
        expect(promotionModel).toBeInstanceOf(PromotionModel);
    });

    describe('isActive', () => {
        it('should return true for active promotion within date range', async () => {
            const promotionId = 'promo-123';
            const mockActivePromotion = {
                id: promotionId,
                startsAt: new Date('2023-01-01'),
                endsAt: new Date('2025-12-31'),
                deletedAt: null
            };

            // Configure mock to return active promotion
            mockDb.select.mockImplementation(() => createQueryMock([mockActivePromotion]));

            const result = await promotionModel.isActive(promotionId);

            expect(result).toBe(true);
        });

        it('should return false for expired promotion', async () => {
            const promotionId = 'promo-789';
            const mockExpiredPromotion = {
                id: promotionId,
                startsAt: new Date('2020-01-01'),
                endsAt: new Date('2022-12-31'),
                deletedAt: null
            };

            // Configure mock to return expired promotion
            mockDb.select.mockImplementation(() => createQueryMock([mockExpiredPromotion]));

            const result = await promotionModel.isActive(promotionId);

            expect(result).toBe(false);
        });

        it('should return false when promotion not found', async () => {
            const promotionId = 'promo-nonexistent';

            // Configure mock to return empty result
            mockDb.select.mockImplementation(() => createQueryMock([]));

            const result = await promotionModel.isActive(promotionId);

            expect(result).toBe(false);
        });

        it('should return false for soft deleted promotion', async () => {
            const promotionId = 'promo-deleted';

            // Configure mock to return empty result since query filters out deleted promotions
            mockDb.select.mockImplementation(() => createQueryMock([]));

            const result = await promotionModel.isActive(promotionId);

            expect(result).toBe(false);
        });
    });

    describe('applyPromotion', () => {
        it('should apply promotion successfully', async () => {
            const promotionId = 'promo-percent';
            const clientId = 'client-123';

            // Mock isActive to return true
            vi.spyOn(promotionModel, 'isActive').mockResolvedValue(true);

            // Mock findById to return promotion
            vi.spyOn(promotionModel, 'findById').mockResolvedValue(mockPromotion);

            // Mock evaluateRules to return eligible
            vi.spyOn(promotionModel, 'evaluateRules').mockResolvedValue({
                eligible: true,
                appliedRules: ['RULE_APPLIED']
            });

            // Mock calculateBenefit to return discount
            vi.spyOn(promotionModel, 'calculateBenefit').mockResolvedValue({
                discountAmount: 2000,
                finalAmount: 8000,
                benefitType: 'PERCENTAGE_DISCOUNT'
            });

            const purchaseData = {
                amount: 10000, // $100.00
                currency: 'USD'
            };

            const result = await promotionModel.applyPromotion(promotionId, clientId, purchaseData);

            expect(result.applied).toBe(true);
            expect(result.discountAmount).toBe(2000);
            expect(result.finalAmount).toBe(8000);
            expect(result.appliedRules).toContain('RULE_APPLIED');
        });

        it('should not apply inactive promotion', async () => {
            const promotionId = 'promo-inactive';
            const clientId = 'client-123';

            // Mock isActive to return false
            vi.spyOn(promotionModel, 'isActive').mockResolvedValue(false);

            const purchaseData = {
                amount: 10000,
                currency: 'USD'
            };

            const result = await promotionModel.applyPromotion(promotionId, clientId, purchaseData);

            expect(result.applied).toBe(false);
            expect(result.discountAmount).toBe(0);
            expect(result.finalAmount).toBe(10000);
            expect(result.reason).toBe('PROMOTION_NOT_ACTIVE');
        });

        it('should not apply when promotion not found', async () => {
            const promotionId = 'promo-missing';
            const clientId = 'client-123';

            // Mock isActive to return true
            vi.spyOn(promotionModel, 'isActive').mockResolvedValue(true);

            // Mock findById to return null
            vi.spyOn(promotionModel, 'findById').mockResolvedValue(null);

            const purchaseData = {
                amount: 10000,
                currency: 'USD'
            };

            const result = await promotionModel.applyPromotion(promotionId, clientId, purchaseData);

            expect(result.applied).toBe(false);
            expect(result.discountAmount).toBe(0);
            expect(result.finalAmount).toBe(10000);
            expect(result.reason).toBe('PROMOTION_NOT_FOUND');
        });

        it('should not apply when rules not met', async () => {
            const promotionId = 'promo-rules-fail';
            const clientId = 'client-123';

            // Mock isActive to return true
            vi.spyOn(promotionModel, 'isActive').mockResolvedValue(true);

            // Mock findById to return promotion
            vi.spyOn(promotionModel, 'findById').mockResolvedValue(mockPromotion);

            // Mock evaluateRules to return not eligible
            vi.spyOn(promotionModel, 'evaluateRules').mockResolvedValue({
                eligible: false,
                reason: 'MINIMUM_AMOUNT_NOT_MET'
            });

            const purchaseData = {
                amount: 1000, // Too low
                currency: 'USD'
            };

            const result = await promotionModel.applyPromotion(promotionId, clientId, purchaseData);

            expect(result.applied).toBe(false);
            expect(result.discountAmount).toBe(0);
            expect(result.finalAmount).toBe(1000);
            expect(result.reason).toBe('MINIMUM_AMOUNT_NOT_MET');
        });
    });

    describe('evaluateRules', () => {
        it('should return eligible when no rules exist', async () => {
            const promotionWithoutRules = {
                ...mockPromotion,
                rules: null
            };

            const result = await promotionModel.evaluateRules(promotionWithoutRules, 'client-123', {
                amount: 10000,
                currency: 'USD'
            });

            expect(result.eligible).toBe(true);
            expect(result.appliedRules).toContain('DEFAULT_ELIGIBLE');
        });

        it('should evaluate minimum amount rule', async () => {
            const promotionWithMinAmount = {
                ...mockPromotion,
                rules: JSON.stringify({
                    minimumAmount: 5000, // $50 minimum
                    discountPercent: 10
                })
            };

            // Test with amount above minimum
            const resultEligible = await promotionModel.evaluateRules(
                promotionWithMinAmount,
                'client-123',
                { amount: 7500, currency: 'USD' }
            );

            expect(resultEligible.eligible).toBe(true);
            expect(resultEligible.appliedRules).toContain('MINIMUM_AMOUNT_CHECK');

            // Test with amount below minimum
            const resultNotEligible = await promotionModel.evaluateRules(
                promotionWithMinAmount,
                'client-123',
                { amount: 3000, currency: 'USD' }
            );

            expect(resultNotEligible.eligible).toBe(false);
            expect(resultNotEligible.reason).toBe('MINIMUM_AMOUNT_NOT_MET');
        });

        it('should evaluate maximum amount rule', async () => {
            const promotionWithMaxAmount = {
                ...mockPromotion,
                rules: JSON.stringify({
                    maximumAmount: 10000, // $100 maximum
                    discountPercent: 15
                })
            };

            // Test with amount below maximum
            const resultEligible = await promotionModel.evaluateRules(
                promotionWithMaxAmount,
                'client-123',
                { amount: 7500, currency: 'USD' }
            );

            expect(resultEligible.eligible).toBe(true);
            expect(resultEligible.appliedRules).toContain('MAXIMUM_AMOUNT_CHECK');

            // Test with amount above maximum
            const resultNotEligible = await promotionModel.evaluateRules(
                promotionWithMaxAmount,
                'client-123',
                { amount: 15000, currency: 'USD' }
            );

            expect(resultNotEligible.eligible).toBe(false);
            expect(resultNotEligible.reason).toBe('MAXIMUM_AMOUNT_EXCEEDED');
        });

        it('should handle invalid JSON rules gracefully', async () => {
            const promotionWithInvalidRules = {
                ...mockPromotion,
                rules: 'invalid-json-string'
            };

            const result = await promotionModel.evaluateRules(
                promotionWithInvalidRules,
                'client-123',
                { amount: 10000, currency: 'USD' }
            );

            expect(result.eligible).toBe(true);
            expect(result.appliedRules).toContain('TEXT_RULES_APPLIED');
        });
    });

    describe('calculateBenefit', () => {
        it('should calculate percentage discount benefit', async () => {
            const promotionWithPercentage = {
                ...mockPromotion,
                rules: JSON.stringify({ discountPercent: 25 })
            };

            const result = await promotionModel.calculateBenefit(promotionWithPercentage, {
                amount: 8000,
                currency: 'USD'
            });

            expect(result.discountAmount).toBe(2000); // 25% of $80
            expect(result.finalAmount).toBe(6000); // $60
            expect(result.benefitType).toBe('PERCENTAGE_DISCOUNT');
        });

        it('should calculate fixed amount discount benefit', async () => {
            const promotionWithFixedAmount = {
                ...mockPromotion,
                rules: JSON.stringify({ discountAmount: 2500 })
            };

            const result = await promotionModel.calculateBenefit(promotionWithFixedAmount, {
                amount: 8000,
                currency: 'USD'
            });

            expect(result.discountAmount).toBe(2500); // $25 off
            expect(result.finalAmount).toBe(5500); // $55
            expect(result.benefitType).toBe('FIXED_DISCOUNT');
        });

        it('should handle no discount rules', async () => {
            const promotionWithoutDiscount = {
                ...mockPromotion,
                rules: JSON.stringify({ someOtherRule: 'value' })
            };

            const result = await promotionModel.calculateBenefit(promotionWithoutDiscount, {
                amount: 8000,
                currency: 'USD'
            });

            expect(result.discountAmount).toBe(0);
            expect(result.finalAmount).toBe(8000);
            expect(result.benefitType).toBe('NONE');
        });

        it('should handle invalid rules gracefully', async () => {
            const promotionWithInvalidRules = {
                ...mockPromotion,
                rules: 'invalid-rules'
            };

            const result = await promotionModel.calculateBenefit(promotionWithInvalidRules, {
                amount: 8000,
                currency: 'USD'
            });

            expect(result.discountAmount).toBe(0);
            expect(result.finalAmount).toBe(8000);
            expect(result.benefitType).toBe('NONE');
        });
    });

    describe('getEligibleClients', () => {
        it('should return eligible clients with mock data', async () => {
            const promotionId = 'promo-eligible';

            // Configure mock to return promotion data
            mockDb.select.mockImplementation(() => createQueryMock([mockPromotion]));

            // For this simplified test, we'll just call the method and verify it doesn't throw
            const result = await promotionModel.getEligibleClients(promotionId, 10);

            // Since this is a placeholder implementation, we just verify it returns an array
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('findActive', () => {
        it('should find active promotions', async () => {
            const mockActivePromotions = [
                {
                    id: 'promo-1',
                    name: 'Active Promo 1',
                    startsAt: new Date('2023-01-01'),
                    endsAt: new Date('2025-12-31')
                },
                {
                    id: 'promo-2',
                    name: 'Active Promo 2',
                    startsAt: new Date('2023-06-01'),
                    endsAt: new Date('2024-12-31')
                }
            ];

            // Configure mock to return active promotions
            mockDb.select.mockImplementation(() => createQueryMock(mockActivePromotions));

            const result = await promotionModel.findActive();

            expect(result).toEqual({
                items: mockActivePromotions,
                total: mockActivePromotions.length
            });
        });
    });

    describe('findByDate', () => {
        it('should find promotions valid for specific date range', async () => {
            const startDate = new Date('2023-01-01');
            const endDate = new Date('2023-12-31');
            const mockPromotionItems = [
                {
                    id: 'promo-valid',
                    name: 'Valid Promo',
                    startsAt: new Date('2023-01-01'),
                    endsAt: new Date('2023-12-31')
                }
            ];

            // Configure mock to return promotion items (method will wrap them in result structure)
            mockDb.select.mockImplementation(() => createQueryMock(mockPromotionItems));

            const result = await promotionModel.findByDate(startDate, endDate);

            expect(result.items).toEqual(mockPromotionItems);
            expect(result.total).toBe(mockPromotionItems.length);
        });

        it('should find promotions with pagination options', async () => {
            const startDate = new Date('2023-01-01');
            const endDate = new Date('2023-12-31');
            const mockPromotionItems = [
                {
                    id: 'promo-current',
                    name: 'Current Promo'
                }
            ];

            // Configure mock for both the main query and count query
            mockDb.select.mockImplementation((fields?: any) => {
                // If fields are provided (count query), return count result
                if (fields && typeof fields === 'object' && 'count' in fields) {
                    return createQueryMock([{ count: mockPromotionItems.length }]);
                }
                // Otherwise return the regular items
                return createQueryMock(mockPromotionItems);
            });

            const result = await promotionModel.findByDate(startDate, endDate, {
                page: 1,
                pageSize: 10
            });

            expect(result.items).toEqual(mockPromotionItems);
            expect(result.total).toBe(mockPromotionItems.length);
        });
    });

    describe('withDiscountCodes', () => {
        it('should find promotions with associated discount codes', async () => {
            // Mock the raw database result (as returned by the leftJoin query)
            const mockRawResults = [
                {
                    id: 'promo-with-codes',
                    name: 'Promo with Codes',
                    rules: null,
                    startsAt: new Date('2023-01-01'),
                    endsAt: new Date('2025-12-31'),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdById: null,
                    updatedById: null,
                    deletedAt: null,
                    deletedById: null,
                    adminInfo: null,
                    discountCodeId: 'code-1',
                    discountCode: 'SAVE10',
                    discountType: 'percentage'
                },
                {
                    id: 'promo-with-codes',
                    name: 'Promo with Codes',
                    rules: null,
                    startsAt: new Date('2023-01-01'),
                    endsAt: new Date('2025-12-31'),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdById: null,
                    updatedById: null,
                    deletedAt: null,
                    deletedById: null,
                    adminInfo: null,
                    discountCodeId: 'code-2',
                    discountCode: 'SAVE20',
                    discountType: 'percentage'
                }
            ];

            // Configure mock to return raw joined results
            mockDb.select.mockImplementation(() => createQueryMock(mockRawResults));

            const result = await promotionModel.withDiscountCodes();

            expect(result.items).toHaveLength(1);
            expect(result.items[0].id).toBe('promo-with-codes');
            expect(result.items[0].discountCodes).toHaveLength(2);
            expect(result.items[0].discountCodes[0].code).toBe('SAVE10');
            expect(result.items[0].discountCodes[1].code).toBe('SAVE20');
        });

        it('should filter by specific promotion when promotionId provided', async () => {
            const mockRawResults = [
                {
                    id: 'promo-active-with-codes',
                    name: 'Active Promo with Codes',
                    rules: null,
                    startsAt: new Date('2023-01-01'),
                    endsAt: new Date('2025-12-31'),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdById: null,
                    updatedById: null,
                    deletedAt: null,
                    deletedById: null,
                    adminInfo: null,
                    discountCodeId: 'code-active',
                    discountCode: 'ACTIVE10',
                    discountType: 'percentage'
                }
            ];

            // Configure mock to return raw joined results for specific promotion
            mockDb.select.mockImplementation(() => createQueryMock(mockRawResults));

            const result = await promotionModel.withDiscountCodes('promo-active-with-codes');

            expect(result.items).toHaveLength(1);
            expect(result.items[0].id).toBe('promo-active-with-codes');
            expect(result.items[0].discountCodes[0].code).toBe('ACTIVE10');
        });
    });

    describe('error handling', () => {
        it('should handle database errors gracefully in isActive', async () => {
            mockDb.select.mockImplementation(() => {
                throw new Error('Database connection failed');
            });

            const result = await promotionModel.isActive('promo-error');

            expect(result).toBe(false);
        });

        it('should handle errors in applyPromotion', async () => {
            const promotionId = 'promo-error';
            const clientId = 'client-123';

            // Mock isActive to throw an error
            vi.spyOn(promotionModel, 'isActive').mockRejectedValue(new Error('Database error'));

            const result = await promotionModel.applyPromotion(promotionId, clientId, {
                amount: 10000,
                currency: 'USD'
            });

            expect(result.applied).toBe(false);
            expect(result.discountAmount).toBe(0);
            expect(result.finalAmount).toBe(10000);
        });
    });
});

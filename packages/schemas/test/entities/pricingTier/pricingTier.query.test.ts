import { describe, expect, it } from 'vitest';
import {
    PricingTierAnalysisResultSchema,
    PricingTierAnalysisSchema,
    PricingTierItemSchema,
    PricingTierLookupResultSchema,
    PricingTierLookupSchema,
    PricingTierSearchResultSchema,
    PricingTierSearchSchema,
    PricingTierSortFieldSchema,
    PricingTierSortSchema
} from '../../../src/entities/pricingTier/pricingTier.query.schema.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';

describe('PricingTier Query Schema', () => {
    const validPlanId = '550e8400-e29b-41d4-a716-446655440001';
    const validTierId = '550e8400-e29b-41d4-a716-446655440000';

    describe('PricingTierSearchSchema', () => {
        it('should validate empty search (default values)', () => {
            const emptySearch = {};
            const result = PricingTierSearchSchema.safeParse(emptySearch);
            expect(result.success).toBe(true);
        });

        it('should validate search with pricing plan filter', () => {
            const searchWithPlan = { pricingPlanId: validPlanId };
            const result = PricingTierSearchSchema.safeParse(searchWithPlan);
            expect(result.success).toBe(true);
        });

        it('should validate quantity range filters', () => {
            const quantitySearch = {
                minQuantityMin: 1,
                minQuantityMax: 10,
                maxQuantityMin: 5,
                maxQuantityMax: 100,
                includesQuantity: 15
            };
            const result = PricingTierSearchSchema.safeParse(quantitySearch);
            expect(result.success).toBe(true);
        });

        it('should validate price range filters', () => {
            const priceSearch = {
                unitPriceMinorMin: BigInt(100),
                unitPriceMinorMax: BigInt(10000)
            };
            const result = PricingTierSearchSchema.safeParse(priceSearch);
            expect(result.success).toBe(true);
        });

        it('should validate lifecycle and status filters', () => {
            const statusSearch = {
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                isActive: true,
                hasUnlimitedMax: false
            };
            const result = PricingTierSearchSchema.safeParse(statusSearch);
            expect(result.success).toBe(true);
        });

        it('should validate date range filters', () => {
            const dateSearch = {
                createdAfter: new Date('2024-01-01'),
                createdBefore: new Date('2024-12-31'),
                updatedAfter: new Date('2024-06-01'),
                updatedBefore: new Date('2024-06-30')
            };
            const result = PricingTierSearchSchema.safeParse(dateSearch);
            expect(result.success).toBe(true);
        });

        it('should validate pagination parameters', () => {
            const paginatedSearch = {
                page: 2,
                pageSize: 50,
                sortBy: 'minQuantity',
                sortOrder: 'desc' as const,
                q: 'search term'
            };
            const result = PricingTierSearchSchema.safeParse(paginatedSearch);
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUID for pricingPlanId', () => {
            const invalidSearch = { pricingPlanId: 'invalid-uuid' };
            const result = PricingTierSearchSchema.safeParse(invalidSearch);
            expect(result.success).toBe(false);
        });

        it('should reject negative quantity values', () => {
            const negativeQuantity = { minQuantityMin: -1 };
            const result = PricingTierSearchSchema.safeParse(negativeQuantity);
            expect(result.success).toBe(false);
        });

        it('should reject zero or negative price values', () => {
            const invalidPrice = { unitPriceMinorMin: BigInt(0) };
            const result = PricingTierSearchSchema.safeParse(invalidPrice);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingTierLookupSchema', () => {
        const validLookup = {
            pricingPlanId: validPlanId,
            quantity: 15
        };

        it('should validate valid lookup', () => {
            const result = PricingTierLookupSchema.safeParse(validLookup);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeInactive).toBe(false); // default value
            }
        });

        it('should validate lookup with includeInactive flag', () => {
            const lookupWithInactive = { ...validLookup, includeInactive: true };
            const result = PricingTierLookupSchema.safeParse(lookupWithInactive);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeInactive).toBe(true);
            }
        });

        it('should reject invalid pricingPlanId', () => {
            const invalidLookup = { ...validLookup, pricingPlanId: 'invalid-uuid' };
            const result = PricingTierLookupSchema.safeParse(invalidLookup);
            expect(result.success).toBe(false);
        });

        it('should reject zero or negative quantity', () => {
            const zeroQuantity = { ...validLookup, quantity: 0 };
            const negativeQuantity = { ...validLookup, quantity: -5 };

            expect(PricingTierLookupSchema.safeParse(zeroQuantity).success).toBe(false);
            expect(PricingTierLookupSchema.safeParse(negativeQuantity).success).toBe(false);
        });
    });

    describe('PricingTierAnalysisSchema', () => {
        const validAnalysis = {
            pricingPlanId: validPlanId
        };

        it('should validate valid analysis request', () => {
            const result = PricingTierAnalysisSchema.safeParse(validAnalysis);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeInactive).toBe(false); // default value
            }
        });

        it('should validate analysis with includeInactive flag', () => {
            const analysisWithInactive = { ...validAnalysis, includeInactive: true };
            const result = PricingTierAnalysisSchema.safeParse(analysisWithInactive);
            expect(result.success).toBe(true);
        });

        it('should reject invalid pricingPlanId', () => {
            const invalidAnalysis = { pricingPlanId: 'invalid-uuid' };
            const result = PricingTierAnalysisSchema.safeParse(invalidAnalysis);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingTierItemSchema', () => {
        const validTierItem = {
            id: validTierId,
            pricingPlanId: validPlanId,
            minQuantity: 1,
            maxQuantity: 10,
            unitPriceMinor: BigInt(999),
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        it('should validate complete tier item', () => {
            const result = PricingTierItemSchema.safeParse(validTierItem);
            expect(result.success).toBe(true);
        });

        it('should validate tier item with optional computed fields', () => {
            const tierWithComputed = {
                ...validTierItem,
                quantityRange: '1-10',
                isUnlimited: false
            };
            const result = PricingTierItemSchema.safeParse(tierWithComputed);
            expect(result.success).toBe(true);
        });

        it('should validate unlimited tier item', () => {
            const unlimitedTier = {
                ...validTierItem,
                maxQuantity: null,
                quantityRange: '1+',
                isUnlimited: true
            };
            const result = PricingTierItemSchema.safeParse(unlimitedTier);
            expect(result.success).toBe(true);
        });

        it('should reject invalid tier IDs', () => {
            const invalidTierItem = { ...validTierItem, id: 'invalid-uuid' };
            const result = PricingTierItemSchema.safeParse(invalidTierItem);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingTierSearchResultSchema', () => {
        const validTierItem = {
            id: validTierId,
            pricingPlanId: validPlanId,
            minQuantity: 1,
            maxQuantity: 10,
            unitPriceMinor: BigInt(999),
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const validSearchResult = {
            data: [validTierItem],
            pagination: {
                page: 1,
                pageSize: 10,
                total: 1,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false
            }
        };

        it('should validate valid search result', () => {
            const result = PricingTierSearchResultSchema.safeParse(validSearchResult);
            expect(result.success).toBe(true);
        });

        it('should validate empty search result', () => {
            const emptyResult = {
                ...validSearchResult,
                data: [],
                pagination: { ...validSearchResult.pagination, total: 0 }
            };
            const result = PricingTierSearchResultSchema.safeParse(emptyResult);
            expect(result.success).toBe(true);
        });
    });

    describe('PricingTierLookupResultSchema', () => {
        const validTierItem = {
            id: validTierId,
            pricingPlanId: validPlanId,
            minQuantity: 1,
            maxQuantity: 10,
            unitPriceMinor: BigInt(999),
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        it('should validate successful lookup result', () => {
            const successfulLookup = {
                tier: validTierItem,
                found: true,
                quantity: 5,
                totalPrice: BigInt(4995) // 5 * 999
            };
            const result = PricingTierLookupResultSchema.safeParse(successfulLookup);
            expect(result.success).toBe(true);
        });

        it('should validate failed lookup result', () => {
            const failedLookup = {
                tier: null,
                found: false,
                quantity: 100
            };
            const result = PricingTierLookupResultSchema.safeParse(failedLookup);
            expect(result.success).toBe(true);
        });
    });

    describe('PricingTierAnalysisResultSchema', () => {
        const validAnalysisResult = {
            pricingPlanId: validPlanId,
            totalTiers: 3,
            hasGaps: false,
            hasOverlaps: false,
            gaps: [],
            overlaps: [],
            hasUnlimitedTier: true,
            unlimitedTierStartsAt: 51,
            maxCoveredQuantity: null
        };

        it('should validate complete analysis result', () => {
            const result = PricingTierAnalysisResultSchema.safeParse(validAnalysisResult);
            expect(result.success).toBe(true);
        });

        it('should validate analysis result with gaps and overlaps', () => {
            const complexAnalysis = {
                ...validAnalysisResult,
                hasGaps: true,
                hasOverlaps: true,
                gaps: [{ fromQuantity: 11, toQuantity: 15 }],
                overlaps: [
                    {
                        tier1Id: validTierId,
                        tier2Id: '550e8400-e29b-41d4-a716-446655440010',
                        conflictRange: { min: 8, max: 12 }
                    }
                ],
                recommendations: [
                    'Consider adding tier for quantities 11-15',
                    'Fix overlap between tiers'
                ]
            };
            const result = PricingTierAnalysisResultSchema.safeParse(complexAnalysis);
            expect(result.success).toBe(true);
        });

        it('should validate analysis result without unlimited tier', () => {
            const noUnlimitedAnalysis = {
                ...validAnalysisResult,
                hasUnlimitedTier: false,
                unlimitedTierStartsAt: undefined,
                maxCoveredQuantity: 100
            };
            const result = PricingTierAnalysisResultSchema.safeParse(noUnlimitedAnalysis);
            expect(result.success).toBe(true);
        });
    });

    describe('PricingTierSortFieldSchema', () => {
        it('should validate all sort fields', () => {
            const validFields = [
                'minQuantity',
                'maxQuantity',
                'unitPriceMinor',
                'createdAt',
                'updatedAt',
                'lifecycleState'
            ];

            for (const field of validFields) {
                const result = PricingTierSortFieldSchema.safeParse(field);
                expect(result.success).toBe(true);
            }
        });

        it('should reject invalid sort fields', () => {
            const invalidFields = ['invalidField', 'price', 'id'];

            for (const field of invalidFields) {
                const result = PricingTierSortFieldSchema.safeParse(field);
                expect(result.success).toBe(false);
            }
        });
    });

    describe('PricingTierSortSchema', () => {
        it('should validate sort with defaults', () => {
            const defaultSort = {};
            const result = PricingTierSortSchema.safeParse(defaultSort);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.field).toBe('minQuantity');
                expect(result.data.direction).toBe('asc');
            }
        });

        it('should validate custom sort configuration', () => {
            const customSort = {
                field: 'unitPriceMinor' as const,
                direction: 'desc' as const
            };
            const result = PricingTierSortSchema.safeParse(customSort);
            expect(result.success).toBe(true);
        });

        it('should reject invalid sort direction', () => {
            const invalidSort = {
                field: 'minQuantity',
                direction: 'invalid'
            };
            const result = PricingTierSortSchema.safeParse(invalidSort);
            expect(result.success).toBe(false);
        });
    });
});

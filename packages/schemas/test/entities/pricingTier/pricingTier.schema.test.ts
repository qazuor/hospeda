import { describe, expect, it } from 'vitest';
import {
    PricingTierRangeValidationSchema,
    PricingTierSchema
} from '../../../src/entities/pricingTier/pricingTier.schema.js';

describe('PricingTier Schema', () => {
    const validPricingTier = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        pricingPlanId: '550e8400-e29b-41d4-a716-446655440001',
        minQuantity: 1,
        maxQuantity: 10,
        unitPriceMinor: BigInt(999),
        lifecycleState: 'ACTIVE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: '550e8400-e29b-41d4-a716-446655440002',
        updatedById: '550e8400-e29b-41d4-a716-446655440002'
    };

    describe('Basic validation', () => {
        it('should validate a valid pricing tier', () => {
            const result = PricingTierSchema.safeParse(validPricingTier);
            expect(result.success).toBe(true);
        });

        it('should reject invalid pricingPlanId UUID', () => {
            const invalidTier = { ...validPricingTier, pricingPlanId: 'invalid-uuid' };
            const result = PricingTierSchema.safeParse(invalidTier);
            expect(result.success).toBe(false);
        });

        it('should reject minQuantity less than 1', () => {
            const invalidTier = { ...validPricingTier, minQuantity: 0 };
            const result = PricingTierSchema.safeParse(invalidTier);
            expect(result.success).toBe(false);
        });

        it('should allow null maxQuantity for unlimited tiers', () => {
            const unlimitedTier = { ...validPricingTier, maxQuantity: null };
            const result = PricingTierSchema.safeParse(unlimitedTier);
            expect(result.success).toBe(true);
        });

        it('should reject zero unitPriceMinor', () => {
            const invalidTier = { ...validPricingTier, unitPriceMinor: BigInt(0) };
            const result = PricingTierSchema.safeParse(invalidTier);
            expect(result.success).toBe(false);
        });

        it('should reject negative unitPriceMinor', () => {
            const invalidTier = { ...validPricingTier, unitPriceMinor: BigInt(-100) };
            const result = PricingTierSchema.safeParse(invalidTier);
            expect(result.success).toBe(false);
        });
    });

    describe('Quantity range validation', () => {
        it('should reject maxQuantity less than minQuantity', () => {
            const invalidTier = { ...validPricingTier, minQuantity: 10, maxQuantity: 5 };
            const result = PricingTierSchema.safeParse(invalidTier);
            expect(result.success).toBe(false);
        });

        it('should reject maxQuantity equal to minQuantity', () => {
            const invalidTier = { ...validPricingTier, minQuantity: 10, maxQuantity: 10 };
            const result = PricingTierSchema.safeParse(invalidTier);
            expect(result.success).toBe(false);
        });

        it('should accept maxQuantity greater than minQuantity', () => {
            const validTier = { ...validPricingTier, minQuantity: 5, maxQuantity: 15 };
            const result = PricingTierSchema.safeParse(validTier);
            expect(result.success).toBe(true);
        });
    });

    describe('Required fields', () => {
        it('should require pricingPlanId', () => {
            const { pricingPlanId, ...tierWithoutPlanId } = validPricingTier;
            const result = PricingTierSchema.safeParse(tierWithoutPlanId);
            expect(result.success).toBe(false);
        });

        it('should require minQuantity', () => {
            const { minQuantity, ...tierWithoutMinQuantity } = validPricingTier;
            const result = PricingTierSchema.safeParse(tierWithoutMinQuantity);
            expect(result.success).toBe(false);
        });

        it('should require unitPriceMinor', () => {
            const { unitPriceMinor, ...tierWithoutPrice } = validPricingTier;
            const result = PricingTierSchema.safeParse(tierWithoutPrice);
            expect(result.success).toBe(false);
        });

        it('should allow optional adminInfo', () => {
            const tierWithAdminInfo = {
                ...validPricingTier,
                adminInfo: { notes: 'Special pricing tier' }
            };
            const result = PricingTierSchema.safeParse(tierWithAdminInfo);
            expect(result.success).toBe(true);
        });
    });
});

describe('PricingTier Range Validation Schema', () => {
    const basePlanId = '550e8400-e29b-41d4-a716-446655440001';

    describe('Non-overlapping ranges', () => {
        it('should validate non-overlapping consecutive ranges', () => {
            const validRanges = {
                pricingPlanId: basePlanId,
                tiers: [
                    { minQuantity: 1, maxQuantity: 10 },
                    { minQuantity: 11, maxQuantity: 50 },
                    { minQuantity: 51, maxQuantity: null }
                ]
            };
            const result = PricingTierRangeValidationSchema.safeParse(validRanges);
            expect(result.success).toBe(true);
        });

        it('should validate non-overlapping with gaps', () => {
            const validRanges = {
                pricingPlanId: basePlanId,
                tiers: [
                    { minQuantity: 1, maxQuantity: 5 },
                    { minQuantity: 10, maxQuantity: 20 },
                    { minQuantity: 30, maxQuantity: null }
                ]
            };
            const result = PricingTierRangeValidationSchema.safeParse(validRanges);
            expect(result.success).toBe(true);
        });

        it('should reject overlapping ranges', () => {
            const overlappingRanges = {
                pricingPlanId: basePlanId,
                tiers: [
                    { minQuantity: 1, maxQuantity: 10 },
                    { minQuantity: 8, maxQuantity: 20 } // Overlaps with previous
                ]
            };
            const result = PricingTierRangeValidationSchema.safeParse(overlappingRanges);
            expect(result.success).toBe(false);
        });

        it('should reject adjacent overlapping ranges', () => {
            const adjacentOverlap = {
                pricingPlanId: basePlanId,
                tiers: [
                    { minQuantity: 1, maxQuantity: 10 },
                    { minQuantity: 10, maxQuantity: 20 } // maxQuantity of first equals minQuantity of second
                ]
            };
            const result = PricingTierRangeValidationSchema.safeParse(adjacentOverlap);
            expect(result.success).toBe(false);
        });
    });

    describe('Unlimited tier placement', () => {
        it('should allow unlimited tier as last tier', () => {
            const validUnlimited = {
                pricingPlanId: basePlanId,
                tiers: [
                    { minQuantity: 1, maxQuantity: 10 },
                    { minQuantity: 11, maxQuantity: null } // Unlimited as last
                ]
            };
            const result = PricingTierRangeValidationSchema.safeParse(validUnlimited);
            expect(result.success).toBe(true);
        });

        it('should reject unlimited tier before last position', () => {
            const invalidUnlimited = {
                pricingPlanId: basePlanId,
                tiers: [
                    { minQuantity: 1, maxQuantity: null }, // Unlimited not last
                    { minQuantity: 11, maxQuantity: 20 }
                ]
            };
            const result = PricingTierRangeValidationSchema.safeParse(invalidUnlimited);
            expect(result.success).toBe(false);
        });

        it('should allow single unlimited tier', () => {
            const singleUnlimited = {
                pricingPlanId: basePlanId,
                tiers: [{ minQuantity: 1, maxQuantity: null }]
            };
            const result = PricingTierRangeValidationSchema.safeParse(singleUnlimited);
            expect(result.success).toBe(true);
        });
    });

    describe('Edge cases', () => {
        it('should require at least one tier', () => {
            const emptyTiers = {
                pricingPlanId: basePlanId,
                tiers: []
            };
            const result = PricingTierRangeValidationSchema.safeParse(emptyTiers);
            expect(result.success).toBe(false);
        });

        it('should handle unordered tiers correctly', () => {
            const unorderedTiers = {
                pricingPlanId: basePlanId,
                tiers: [
                    { minQuantity: 11, maxQuantity: 20 },
                    { minQuantity: 1, maxQuantity: 10 },
                    { minQuantity: 21, maxQuantity: null }
                ]
            };
            const result = PricingTierRangeValidationSchema.safeParse(unorderedTiers);
            expect(result.success).toBe(true); // Should sort internally and validate
        });

        it('should support optional tier IDs for updates', () => {
            const tiersWithIds = {
                pricingPlanId: basePlanId,
                tiers: [
                    {
                        id: '550e8400-e29b-41d4-a716-446655440010',
                        minQuantity: 1,
                        maxQuantity: 10
                    },
                    {
                        minQuantity: 11,
                        maxQuantity: null
                    }
                ]
            };
            const result = PricingTierRangeValidationSchema.safeParse(tiersWithIds);
            expect(result.success).toBe(true);
        });
    });
});

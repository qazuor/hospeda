import { describe, expect, it } from 'vitest';
import {
    PricingTierBulkCreateInputSchema,
    PricingTierBulkDeleteInputSchema,
    PricingTierCreateInputSchema,
    PricingTierDeleteInputSchema,
    PricingTierRangeUpdateValidationSchema,
    PricingTierUpdateInputSchema,
    PricingTierUpdateWithContextSchema
} from '../../../src/entities/pricingTier/pricingTier.crud.schema.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';

describe('PricingTier CRUD Schema', () => {
    const validPlanId = '550e8400-e29b-41d4-a716-446655440001';
    const validTierId = '550e8400-e29b-41d4-a716-446655440000';

    describe('PricingTierCreateInputSchema', () => {
        const validCreateInput = {
            pricingPlanId: validPlanId,
            minQuantity: 1,
            maxQuantity: 10,
            unitPriceMinor: BigInt(999)
        };

        it('should validate valid create input', () => {
            const result = PricingTierCreateInputSchema.safeParse(validCreateInput);
            expect(result.success).toBe(true);
        });

        it('should allow null maxQuantity for unlimited tiers', () => {
            const unlimitedTier = { ...validCreateInput, maxQuantity: null };
            const result = PricingTierCreateInputSchema.safeParse(unlimitedTier);
            expect(result.success).toBe(true);
        });

        it('should reject invalid pricingPlanId', () => {
            const invalidInput = { ...validCreateInput, pricingPlanId: 'invalid-uuid' };
            const result = PricingTierCreateInputSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject minQuantity less than 1', () => {
            const invalidInput = { ...validCreateInput, minQuantity: 0 };
            const result = PricingTierCreateInputSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject maxQuantity less than or equal to minQuantity', () => {
            const invalidInput = { ...validCreateInput, minQuantity: 10, maxQuantity: 5 };
            const result = PricingTierCreateInputSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject zero or negative unitPriceMinor', () => {
            const zeroPrice = { ...validCreateInput, unitPriceMinor: BigInt(0) };
            const negativePrice = { ...validCreateInput, unitPriceMinor: BigInt(-100) };

            expect(PricingTierCreateInputSchema.safeParse(zeroPrice).success).toBe(false);
            expect(PricingTierCreateInputSchema.safeParse(negativePrice).success).toBe(false);
        });
    });

    describe('PricingTierBulkCreateInputSchema', () => {
        const validBulkInput = {
            pricingPlanId: validPlanId,
            tiers: [
                { minQuantity: 1, maxQuantity: 10, unitPriceMinor: BigInt(999) },
                { minQuantity: 11, maxQuantity: 50, unitPriceMinor: BigInt(899) },
                { minQuantity: 51, maxQuantity: null, unitPriceMinor: BigInt(799) }
            ]
        };

        it('should validate valid non-overlapping tiers', () => {
            const result = PricingTierBulkCreateInputSchema.safeParse(validBulkInput);
            expect(result.success).toBe(true);
        });

        it('should reject overlapping tier ranges', () => {
            const overlappingInput = {
                pricingPlanId: validPlanId,
                tiers: [
                    { minQuantity: 1, maxQuantity: 10, unitPriceMinor: BigInt(999) },
                    { minQuantity: 8, maxQuantity: 20, unitPriceMinor: BigInt(899) } // Overlaps
                ]
            };
            const result = PricingTierBulkCreateInputSchema.safeParse(overlappingInput);
            expect(result.success).toBe(false);
        });

        it('should reject empty tiers array', () => {
            const emptyInput = { pricingPlanId: validPlanId, tiers: [] };
            const result = PricingTierBulkCreateInputSchema.safeParse(emptyInput);
            expect(result.success).toBe(false);
        });

        it('should reject tiers with invalid individual constraints', () => {
            const invalidTierInput = {
                pricingPlanId: validPlanId,
                tiers: [
                    { minQuantity: 10, maxQuantity: 5, unitPriceMinor: BigInt(999) } // maxQuantity < minQuantity
                ]
            };
            const result = PricingTierBulkCreateInputSchema.safeParse(invalidTierInput);
            expect(result.success).toBe(false);
        });

        it('should allow unlimited tier as last tier only', () => {
            const validUnlimitedLast = {
                pricingPlanId: validPlanId,
                tiers: [
                    { minQuantity: 1, maxQuantity: 10, unitPriceMinor: BigInt(999) },
                    { minQuantity: 11, maxQuantity: null, unitPriceMinor: BigInt(899) }
                ]
            };
            const result = PricingTierBulkCreateInputSchema.safeParse(validUnlimitedLast);
            expect(result.success).toBe(true);
        });
    });

    describe('PricingTierUpdateInputSchema', () => {
        it('should validate partial updates', () => {
            const partialUpdate = { minQuantity: 5 };
            const result = PricingTierUpdateInputSchema.safeParse(partialUpdate);
            expect(result.success).toBe(true);
        });

        it('should validate lifecycle state updates', () => {
            const lifecycleUpdate = { lifecycleState: LifecycleStatusEnum.ARCHIVED };
            const result = PricingTierUpdateInputSchema.safeParse(lifecycleUpdate);
            expect(result.success).toBe(true);
        });

        it('should validate quantity range updates', () => {
            const rangeUpdate = { minQuantity: 5, maxQuantity: 15 };
            const result = PricingTierUpdateInputSchema.safeParse(rangeUpdate);
            expect(result.success).toBe(true);
        });

        it('should reject invalid quantity range updates', () => {
            const invalidRangeUpdate = { minQuantity: 15, maxQuantity: 10 };
            const result = PricingTierUpdateInputSchema.safeParse(invalidRangeUpdate);
            expect(result.success).toBe(false);
        });

        it('should allow empty updates', () => {
            const emptyUpdate = {};
            const result = PricingTierUpdateInputSchema.safeParse(emptyUpdate);
            expect(result.success).toBe(true);
        });

        it('should allow updating maxQuantity to null', () => {
            const unlimitedUpdate = { maxQuantity: null };
            const result = PricingTierUpdateInputSchema.safeParse(unlimitedUpdate);
            expect(result.success).toBe(true);
        });
    });

    describe('PricingTierUpdateWithContextSchema', () => {
        const validContextUpdate = {
            id: validTierId,
            updates: { minQuantity: 5 },
            existingTiers: [
                { id: validTierId, minQuantity: 1, maxQuantity: 10 },
                { id: '550e8400-e29b-41d4-a716-446655440010', minQuantity: 11, maxQuantity: 20 }
            ]
        };

        it('should validate update with context', () => {
            const result = PricingTierUpdateWithContextSchema.safeParse(validContextUpdate);
            expect(result.success).toBe(true);
        });

        it('should allow updates without existing tiers context', () => {
            const updateWithoutContext = {
                id: validTierId,
                updates: { unitPriceMinor: BigInt(1299) }
            };
            const result = PricingTierUpdateWithContextSchema.safeParse(updateWithoutContext);
            expect(result.success).toBe(true);
        });

        it('should require valid tier ID', () => {
            const invalidIdUpdate = { ...validContextUpdate, id: 'invalid-uuid' };
            const result = PricingTierUpdateWithContextSchema.safeParse(invalidIdUpdate);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingTierDeleteInputSchema', () => {
        it('should validate soft delete (default)', () => {
            const deleteInput = { id: validTierId };
            const result = PricingTierDeleteInputSchema.safeParse(deleteInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.force).toBe(false);
            }
        });

        it('should validate force delete', () => {
            const forceDeleteInput = { id: validTierId, force: true };
            const result = PricingTierDeleteInputSchema.safeParse(forceDeleteInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.force).toBe(true);
            }
        });

        it('should reject invalid tier ID', () => {
            const invalidDeleteInput = { id: 'invalid-uuid' };
            const result = PricingTierDeleteInputSchema.safeParse(invalidDeleteInput);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingTierBulkDeleteInputSchema', () => {
        const validBulkDelete = {
            ids: [validTierId, '550e8400-e29b-41d4-a716-446655440010']
        };

        it('should validate bulk delete', () => {
            const result = PricingTierBulkDeleteInputSchema.safeParse(validBulkDelete);
            expect(result.success).toBe(true);
        });

        it('should validate bulk force delete', () => {
            const forceDeleteInput = { ...validBulkDelete, force: true };
            const result = PricingTierBulkDeleteInputSchema.safeParse(forceDeleteInput);
            expect(result.success).toBe(true);
        });

        it('should reject empty IDs array', () => {
            const emptyDeleteInput = { ids: [] };
            const result = PricingTierBulkDeleteInputSchema.safeParse(emptyDeleteInput);
            expect(result.success).toBe(false);
        });

        it('should reject invalid tier IDs', () => {
            const invalidIdsInput = { ids: ['invalid-uuid', validTierId] };
            const result = PricingTierBulkDeleteInputSchema.safeParse(invalidIdsInput);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingTierRangeUpdateValidationSchema', () => {
        const existingTiers = [
            { id: validTierId, minQuantity: 1, maxQuantity: 10 },
            { id: '550e8400-e29b-41d4-a716-446655440010', minQuantity: 11, maxQuantity: 20 },
            { id: '550e8400-e29b-41d4-a716-446655440020', minQuantity: 21, maxQuantity: null }
        ];

        it('should validate non-conflicting range update', () => {
            const validRangeUpdate = {
                pricingPlanId: validPlanId,
                tierId: validTierId,
                newMinQuantity: 2,
                newMaxQuantity: 9,
                existingTiers
            };
            const result = PricingTierRangeUpdateValidationSchema.safeParse(validRangeUpdate);
            expect(result.success).toBe(true);
        });

        it('should reject conflicting range update', () => {
            const conflictingRangeUpdate = {
                pricingPlanId: validPlanId,
                tierId: validTierId,
                newMinQuantity: 5,
                newMaxQuantity: 15, // Would overlap with second tier
                existingTiers
            };
            const result = PricingTierRangeUpdateValidationSchema.safeParse(conflictingRangeUpdate);
            expect(result.success).toBe(false);
        });

        it('should validate partial range updates', () => {
            const partialRangeUpdate = {
                pricingPlanId: validPlanId,
                tierId: validTierId,
                newMinQuantity: 2, // Only updating minQuantity
                existingTiers
            };
            const result = PricingTierRangeUpdateValidationSchema.safeParse(partialRangeUpdate);
            expect(result.success).toBe(true);
        });

        it('should validate extending range to unlimited', () => {
            const unlimitedUpdate = {
                pricingPlanId: validPlanId,
                tierId: '550e8400-e29b-41d4-a716-446655440010', // Middle tier
                newMaxQuantity: null, // Making it unlimited
                existingTiers: existingTiers.filter(
                    (t) => t.id !== '550e8400-e29b-41d4-a716-446655440020'
                ) // Remove the last tier
            };
            const result = PricingTierRangeUpdateValidationSchema.safeParse(unlimitedUpdate);
            expect(result.success).toBe(true);
        });
    });
});

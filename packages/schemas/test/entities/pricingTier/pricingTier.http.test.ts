import { describe, expect, it } from 'vitest';
import {
    HttpPricingTierAnalysisSchema,
    HttpPricingTierLookupSchema,
    HttpPricingTierSearchSchema,
    PricingPlanIdPathSchema,
    PricingTierBulkCreateHttpSchema,
    PricingTierBulkDeleteHttpSchema,
    PricingTierCreateHttpSchema,
    PricingTierCreateResponseSchema,
    PricingTierIdPathSchema,
    PricingTierUpdateHttpSchema,
    PricingTierValidationErrorSchema
} from '../../../src/entities/pricingTier/pricingTier.http.schema.js';

describe('PricingTier HTTP Schema', () => {
    const validPlanId = '550e8400-e29b-41d4-a716-446655440001';
    const validTierId = '550e8400-e29b-41d4-a716-446655440000';

    describe('HttpPricingTierSearchSchema', () => {
        it('should coerce string pagination parameters to numbers', () => {
            const searchParams = {
                page: '2',
                pageSize: '50'
            };
            const result = HttpPricingTierSearchSchema.safeParse(searchParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(2);
                expect(result.data.pageSize).toBe(50);
            }
        });

        it('should coerce string quantity parameters', () => {
            const searchParams = {
                minQuantityMin: '1',
                minQuantityMax: '10',
                maxQuantityMin: '5',
                maxQuantityMax: '100',
                includesQuantity: '15'
            };
            const result = HttpPricingTierSearchSchema.safeParse(searchParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.minQuantityMin).toBe(1);
                expect(result.data.maxQuantityMax).toBe(100);
                expect(result.data.includesQuantity).toBe(15);
            }
        });

        it('should coerce string price parameters to BigInt', () => {
            const searchParams = {
                unitPriceMinorMin: '999',
                unitPriceMinorMax: '99999'
            };
            const result = HttpPricingTierSearchSchema.safeParse(searchParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.unitPriceMinorMin).toBe(BigInt(999));
                expect(result.data.unitPriceMinorMax).toBe(BigInt(99999));
            }
        });

        it('should coerce string boolean parameters', () => {
            const booleanTests = [
                { hasUnlimitedMax: 'true', field: 'hasUnlimitedMax', expected: true },
                { hasUnlimitedMax: 'false', field: 'hasUnlimitedMax', expected: false },
                { hasUnlimitedMax: '1', field: 'hasUnlimitedMax', expected: true },
                { hasUnlimitedMax: '0', field: 'hasUnlimitedMax', expected: false },
                { isActive: 'TRUE', field: 'isActive', expected: true },
                { isActive: 'FALSE', field: 'isActive', expected: false }
            ];

            for (const test of booleanTests) {
                const result = HttpPricingTierSearchSchema.safeParse(test);
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data[test.field as keyof typeof result.data]).toBe(test.expected);
                }
            }
        });

        it('should coerce string date parameters', () => {
            const searchParams = {
                createdAfter: '2024-01-01',
                createdBefore: '2024-12-31'
            };
            const result = HttpPricingTierSearchSchema.safeParse(searchParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.createdAfter).toBeInstanceOf(Date);
                expect(result.data.createdBefore).toBeInstanceOf(Date);
            }
        });

        it('should apply default values for pagination', () => {
            const emptySearch = {};
            const result = HttpPricingTierSearchSchema.safeParse(emptySearch);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(10);
            }
        });

        it('should reject invalid price values', () => {
            const invalidSearch = { unitPriceMinorMin: '0' };
            const result = HttpPricingTierSearchSchema.safeParse(invalidSearch);
            expect(result.success).toBe(false);
        });
    });

    describe('HttpPricingTierLookupSchema', () => {
        it('should coerce string quantity to number', () => {
            const lookupParams = {
                pricingPlanId: validPlanId,
                quantity: '15',
                includeInactive: 'true'
            };
            const result = HttpPricingTierLookupSchema.safeParse(lookupParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.quantity).toBe(15);
                expect(result.data.includeInactive).toBe(true);
            }
        });

        it('should apply default value for includeInactive', () => {
            const lookupParams = {
                pricingPlanId: validPlanId,
                quantity: '10'
            };
            const result = HttpPricingTierLookupSchema.safeParse(lookupParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeInactive).toBe(false);
            }
        });

        it('should reject zero or negative quantity', () => {
            const invalidLookup = {
                pricingPlanId: validPlanId,
                quantity: '0'
            };
            const result = HttpPricingTierLookupSchema.safeParse(invalidLookup);
            expect(result.success).toBe(false);
        });
    });

    describe('HttpPricingTierAnalysisSchema', () => {
        it('should coerce includeInactive boolean', () => {
            const analysisParams = {
                pricingPlanId: validPlanId,
                includeInactive: 'true'
            };
            const result = HttpPricingTierAnalysisSchema.safeParse(analysisParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeInactive).toBe(true);
            }
        });

        it('should apply default value for includeInactive', () => {
            const analysisParams = {
                pricingPlanId: validPlanId
            };
            const result = HttpPricingTierAnalysisSchema.safeParse(analysisParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeInactive).toBe(false);
            }
        });
    });

    describe('PricingTierCreateHttpSchema', () => {
        it('should coerce numeric parameters', () => {
            const createParams = {
                pricingPlanId: validPlanId,
                minQuantity: '1',
                maxQuantity: '10',
                unitPriceMinor: '999'
            };
            const result = PricingTierCreateHttpSchema.safeParse(createParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.minQuantity).toBe(1);
                expect(result.data.maxQuantity).toBe(10);
                expect(result.data.unitPriceMinor).toBe(BigInt(999));
            }
        });

        it('should handle null/unlimited maxQuantity variations', () => {
            const unlimitedVariations = ['null', 'unlimited', '', 'infinity'];

            for (const maxQuantity of unlimitedVariations) {
                const createParams = {
                    pricingPlanId: validPlanId,
                    minQuantity: '1',
                    maxQuantity,
                    unitPriceMinor: '999'
                };
                const result = PricingTierCreateHttpSchema.safeParse(createParams);
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.maxQuantity).toBeNull();
                }
            }
        });

        it('should validate quantity range constraint', () => {
            const invalidRange = {
                pricingPlanId: validPlanId,
                minQuantity: '10',
                maxQuantity: '5', // Invalid: max < min
                unitPriceMinor: '999'
            };
            const result = PricingTierCreateHttpSchema.safeParse(invalidRange);
            expect(result.success).toBe(false);
        });

        it('should reject invalid price values', () => {
            const invalidPrice = {
                pricingPlanId: validPlanId,
                minQuantity: '1',
                maxQuantity: '10',
                unitPriceMinor: '0'
            };
            const result = PricingTierCreateHttpSchema.safeParse(invalidPrice);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingTierUpdateHttpSchema', () => {
        it('should handle partial updates with coercion', () => {
            const updateParams = {
                minQuantity: '5',
                unitPriceMinor: '1299'
            };
            const result = PricingTierUpdateHttpSchema.safeParse(updateParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.minQuantity).toBe(5);
                expect(result.data.unitPriceMinor).toBe(BigInt(1299));
            }
        });

        it('should handle null maxQuantity update', () => {
            const updateParams = {
                maxQuantity: 'null'
            };
            const result = PricingTierUpdateHttpSchema.safeParse(updateParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.maxQuantity).toBeNull();
            }
        });

        it('should validate quantity constraint when both provided', () => {
            const invalidUpdate = {
                minQuantity: '15',
                maxQuantity: '10'
            };
            const result = PricingTierUpdateHttpSchema.safeParse(invalidUpdate);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingTierBulkCreateHttpSchema', () => {
        it('should handle JSON string tiers array', () => {
            const bulkParams = {
                pricingPlanId: validPlanId,
                tiers: JSON.stringify([
                    { minQuantity: 1, maxQuantity: 10, unitPriceMinor: '999' },
                    { minQuantity: 11, maxQuantity: null, unitPriceMinor: '899' }
                ])
            };
            const result = PricingTierBulkCreateHttpSchema.safeParse(bulkParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.tiers).toHaveLength(2);
            }
        });

        it('should handle direct array input', () => {
            const bulkParams = {
                pricingPlanId: validPlanId,
                tiers: [
                    { minQuantity: '1', maxQuantity: '10', unitPriceMinor: '999' },
                    { minQuantity: '11', maxQuantity: null, unitPriceMinor: '899' }
                ]
            };
            const result = PricingTierBulkCreateHttpSchema.safeParse(bulkParams);
            expect(result.success).toBe(true);
        });

        it('should reject empty tiers array', () => {
            const bulkParams = {
                pricingPlanId: validPlanId,
                tiers: []
            };
            const result = PricingTierBulkCreateHttpSchema.safeParse(bulkParams);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingTierBulkDeleteHttpSchema', () => {
        it('should handle comma-separated ID string', () => {
            const deleteParams = {
                ids: `${validTierId}, 550e8400-e29b-41d4-a716-446655440010`,
                force: 'false'
            };
            const result = PricingTierBulkDeleteHttpSchema.safeParse(deleteParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toHaveLength(2);
                expect(result.data.force).toBe(false);
            }
        });

        it('should handle direct array input', () => {
            const deleteParams = {
                ids: [validTierId, '550e8400-e29b-41d4-a716-446655440010'],
                force: 'true'
            };
            const result = PricingTierBulkDeleteHttpSchema.safeParse(deleteParams);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.force).toBe(true);
            }
        });

        it('should reject invalid UUIDs', () => {
            const deleteParams = {
                ids: 'invalid-uuid,another-invalid'
            };
            const result = PricingTierBulkDeleteHttpSchema.safeParse(deleteParams);
            expect(result.success).toBe(false);
        });
    });

    describe('Path Parameter Schemas', () => {
        it('should validate pricing tier ID path parameter', () => {
            const pathParams = { id: validTierId };
            const result = PricingTierIdPathSchema.safeParse(pathParams);
            expect(result.success).toBe(true);
        });

        it('should validate pricing plan ID path parameter', () => {
            const pathParams = { pricingPlanId: validPlanId };
            const result = PricingPlanIdPathSchema.safeParse(pathParams);
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUID in path parameters', () => {
            const invalidTierPath = { id: 'invalid-uuid' };
            const invalidPlanPath = { pricingPlanId: 'invalid-uuid' };

            expect(PricingTierIdPathSchema.safeParse(invalidTierPath).success).toBe(false);
            expect(PricingPlanIdPathSchema.safeParse(invalidPlanPath).success).toBe(false);
        });
    });

    describe('Response Schemas', () => {
        it('should validate successful creation response', () => {
            const successResponse = {
                success: true,
                data: {
                    id: validTierId,
                    pricingPlanId: validPlanId,
                    minQuantity: 1,
                    maxQuantity: 10,
                    unitPriceMinor: BigInt(999),
                    lifecycleState: 'ACTIVE',
                    createdAt: new Date(),
                    quantityRange: '1-10'
                }
            };
            const result = PricingTierCreateResponseSchema.safeParse(successResponse);
            expect(result.success).toBe(true);
        });

        it('should validate error response', () => {
            const errorResponse = {
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Invalid pricing tier data'
                }
            };
            const result = PricingTierCreateResponseSchema.safeParse(errorResponse);
            expect(result.success).toBe(true);
        });

        it('should validate validation error schema', () => {
            const validationError = {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    details: [
                        {
                            field: 'minQuantity',
                            message: 'Must be at least 1',
                            value: 0
                        }
                    ]
                }
            };
            const result = PricingTierValidationErrorSchema.safeParse(validationError);
            expect(result.success).toBe(true);
        });
    });
});

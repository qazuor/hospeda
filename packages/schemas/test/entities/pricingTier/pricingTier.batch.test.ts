import { describe, expect, it } from 'vitest';
import {
    PricingTierBatchCreateItemSchema,
    PricingTierBatchCreateRequestSchema,
    PricingTierBatchDeleteItemSchema,
    PricingTierBatchDeleteRequestSchema,
    PricingTierBatchErrorSchema,
    PricingTierBatchItemResultSchema,
    PricingTierBatchResultSchema,
    PricingTierBatchUpdateItemSchema,
    PricingTierBatchUpdateRequestSchema,
    PricingTierRestructureRequestSchema,
    PricingTierRestructureResponseSchema
} from '../../../src/entities/pricingTier/pricingTier.batch.schema.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';

describe('PricingTier Batch Schema', () => {
    const validTierId = '550e8400-e29b-41d4-a716-446655440000';
    const validPlanId = '550e8400-e29b-41d4-a716-446655440001';

    describe('PricingTierBatchErrorSchema', () => {
        it('should validate batch error structure', () => {
            const batchError = {
                index: 0,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: { field: 'minQuantity' }
            };
            const result = PricingTierBatchErrorSchema.safeParse(batchError);
            expect(result.success).toBe(true);
        });

        it('should require minimum fields', () => {
            const minimalError = {
                index: 0,
                error: 'Error message',
                code: 'ERROR_CODE'
            };
            const result = PricingTierBatchErrorSchema.safeParse(minimalError);
            expect(result.success).toBe(true);
        });
    });

    describe('PricingTierBatchItemResultSchema', () => {
        it('should validate successful batch item result', () => {
            const successResult = {
                success: true,
                item: {
                    id: validTierId,
                    pricingPlanId: validPlanId,
                    minQuantity: 1,
                    maxQuantity: 10,
                    unitPriceMinor: BigInt(999),
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdById: validTierId,
                    updatedById: validTierId
                },
                clientId: 'client-123'
            };
            const result = PricingTierBatchItemResultSchema.safeParse(successResult);
            expect(result.success).toBe(true);
        });

        it('should validate failed batch item result', () => {
            const failureResult = {
                success: false,
                error: 'Tier creation failed',
                clientId: 'client-456'
            };
            const result = PricingTierBatchItemResultSchema.safeParse(failureResult);
            expect(result.success).toBe(true);
        });
    });

    describe('PricingTierBatchResultSchema', () => {
        it('should validate complete batch result', () => {
            const batchResult = {
                success: true,
                operation: 'create' as const,
                totalRequested: 5,
                totalProcessed: 5,
                totalSucceeded: 4,
                totalFailed: 1,
                results: [
                    {
                        success: true,
                        item: {
                            id: validTierId,
                            pricingPlanId: validPlanId,
                            minQuantity: 1,
                            maxQuantity: 10,
                            unitPriceMinor: BigInt(999),
                            lifecycleState: LifecycleStatusEnum.ACTIVE,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            createdById: validTierId,
                            updatedById: validTierId
                        }
                    }
                ],
                errors: [
                    {
                        index: 1,
                        error: 'Validation failed',
                        code: 'VALIDATION_ERROR'
                    }
                ],
                executionTimeMs: 150
            };
            const result = PricingTierBatchResultSchema.safeParse(batchResult);
            expect(result.success).toBe(true);
        });
    });

    describe('Batch Create Operations', () => {
        describe('PricingTierBatchCreateItemSchema', () => {
            it('should validate batch create item', () => {
                const createItem = {
                    pricingPlanId: validPlanId,
                    minQuantity: 1,
                    maxQuantity: 10,
                    unitPriceMinor: BigInt(999),
                    clientId: 'item-1',
                    positionHint: 0
                };
                const result = PricingTierBatchCreateItemSchema.safeParse(createItem);
                expect(result.success).toBe(true);
            });

            it('should work without optional fields', () => {
                const minimalItem = {
                    pricingPlanId: validPlanId,
                    minQuantity: 1,
                    maxQuantity: 10,
                    unitPriceMinor: BigInt(999)
                };
                const result = PricingTierBatchCreateItemSchema.safeParse(minimalItem);
                expect(result.success).toBe(true);
            });
        });

        describe('PricingTierBatchCreateRequestSchema', () => {
            it('should validate batch create request with options', () => {
                const createRequest = {
                    items: [
                        {
                            pricingPlanId: validPlanId,
                            minQuantity: 1,
                            maxQuantity: 10,
                            unitPriceMinor: BigInt(999)
                        },
                        {
                            pricingPlanId: validPlanId,
                            minQuantity: 11,
                            maxQuantity: null,
                            unitPriceMinor: BigInt(899)
                        }
                    ],
                    options: {
                        validateRangeContinuity: true,
                        allowGaps: false,
                        replaceExisting: false,
                        optimizePositioning: true,
                        validatePriceProgression: true
                    },
                    transactionId: '550e8400-e29b-41d4-a716-446655440010'
                };
                const result = PricingTierBatchCreateRequestSchema.safeParse(createRequest);
                expect(result.success).toBe(true);
            });

            it('should validate minimal batch create request', () => {
                const minimalRequest = {
                    items: [
                        {
                            pricingPlanId: validPlanId,
                            minQuantity: 1,
                            maxQuantity: 10,
                            unitPriceMinor: BigInt(999)
                        }
                    ]
                };
                const result = PricingTierBatchCreateRequestSchema.safeParse(minimalRequest);
                expect(result.success).toBe(true);
            });

            it('should reject empty items array', () => {
                const invalidRequest = {
                    items: []
                };
                const result = PricingTierBatchCreateRequestSchema.safeParse(invalidRequest);
                expect(result.success).toBe(false);
            });

            it('should reject too many items', () => {
                const tooManyItems = {
                    items: Array.from({ length: 51 }, (_, i) => ({
                        pricingPlanId: validPlanId,
                        minQuantity: i * 10 + 1,
                        maxQuantity: (i + 1) * 10,
                        unitPriceMinor: BigInt(1000 - i * 10)
                    }))
                };
                const result = PricingTierBatchCreateRequestSchema.safeParse(tooManyItems);
                expect(result.success).toBe(false);
            });
        });
    });

    describe('Batch Update Operations', () => {
        describe('PricingTierBatchUpdateItemSchema', () => {
            it('should validate batch update item', () => {
                const updateItem = {
                    id: validTierId,
                    data: {
                        unitPriceMinor: BigInt(1099),
                        maxQuantity: 15
                    },
                    clientId: 'update-1'
                };
                const result = PricingTierBatchUpdateItemSchema.safeParse(updateItem);
                expect(result.success).toBe(true);
            });
        });

        describe('PricingTierBatchUpdateRequestSchema', () => {
            it('should validate batch update request', () => {
                const updateRequest = {
                    items: [
                        {
                            id: validTierId,
                            data: { unitPriceMinor: BigInt(1099) }
                        }
                    ],
                    options: {
                        validateRangeContinuity: true,
                        allowPartialSuccess: false,
                        reoptimizePositioning: true,
                        validatePriceProgression: true
                    }
                };
                const result = PricingTierBatchUpdateRequestSchema.safeParse(updateRequest);
                expect(result.success).toBe(true);
            });
        });
    });

    describe('Batch Delete Operations', () => {
        describe('PricingTierBatchDeleteItemSchema', () => {
            it('should validate batch delete item', () => {
                const deleteItem = {
                    id: validTierId,
                    mode: 'soft' as const,
                    clientId: 'delete-1'
                };
                const result = PricingTierBatchDeleteItemSchema.safeParse(deleteItem);
                expect(result.success).toBe(true);
            });

            it('should default to soft delete', () => {
                const minimalDelete = {
                    id: validTierId
                };
                const result = PricingTierBatchDeleteItemSchema.safeParse(minimalDelete);
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.mode).toBe('soft');
                }
            });
        });

        describe('PricingTierBatchDeleteRequestSchema', () => {
            it('should validate batch delete request', () => {
                const deleteRequest = {
                    items: [
                        { id: validTierId, mode: 'soft' as const },
                        { id: '550e8400-e29b-41d4-a716-446655440010', mode: 'hard' as const }
                    ],
                    options: {
                        validateRangeContinuity: true,
                        allowPartialSuccess: false,
                        reoptimizePositioning: true,
                        cascadeDelete: false
                    }
                };
                const result = PricingTierBatchDeleteRequestSchema.safeParse(deleteRequest);
                expect(result.success).toBe(true);
            });
        });
    });

    describe('Advanced Operations', () => {
        describe('PricingTierRestructureRequestSchema', () => {
            it('should validate tier restructure request', () => {
                const restructureRequest = {
                    pricingPlanId: validPlanId,
                    newStructure: [
                        {
                            minQuantity: 1,
                            maxQuantity: 5,
                            unitPriceMinor: BigInt(1199)
                        },
                        {
                            minQuantity: 6,
                            maxQuantity: 15,
                            unitPriceMinor: BigInt(999)
                        },
                        {
                            minQuantity: 16,
                            maxQuantity: null,
                            unitPriceMinor: BigInt(799)
                        }
                    ],
                    options: {
                        createBackup: true,
                        validateBeforeApply: true,
                        atomic: true,
                        preserveIds: false
                    },
                    transactionId: '550e8400-e29b-41d4-a716-446655440020'
                };
                const result = PricingTierRestructureRequestSchema.safeParse(restructureRequest);
                expect(result.success).toBe(true);
            });

            it('should require at least one tier in new structure', () => {
                const emptyStructure = {
                    pricingPlanId: validPlanId,
                    newStructure: []
                };
                const result = PricingTierRestructureRequestSchema.safeParse(emptyStructure);
                expect(result.success).toBe(false);
            });

            it('should reject too many tiers in restructure', () => {
                const tooManyTiers = {
                    pricingPlanId: validPlanId,
                    newStructure: Array.from({ length: 21 }, (_, i) => ({
                        minQuantity: i * 10 + 1,
                        maxQuantity: (i + 1) * 10,
                        unitPriceMinor: BigInt(1000 - i * 10)
                    }))
                };
                const result = PricingTierRestructureRequestSchema.safeParse(tooManyTiers);
                expect(result.success).toBe(false);
            });
        });

        describe('PricingTierRestructureResponseSchema', () => {
            it('should validate successful restructure response', () => {
                const successResponse = {
                    success: true,
                    message: 'Restructure completed successfully',
                    newTiers: [
                        {
                            id: validTierId,
                            pricingPlanId: validPlanId,
                            minQuantity: 1,
                            maxQuantity: 10,
                            unitPriceMinor: BigInt(999),
                            lifecycleState: LifecycleStatusEnum.ACTIVE,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            createdById: validTierId,
                            updatedById: validTierId
                        }
                    ],
                    backup: {
                        id: '550e8400-e29b-41d4-a716-446655440030',
                        createdAt: new Date(),
                        originalTiers: []
                    },
                    statistics: {
                        tiersCreated: 1,
                        tiersUpdated: 0,
                        tiersDeleted: 2,
                        processingTimeMs: 250
                    },
                    errors: []
                };
                const result = PricingTierRestructureResponseSchema.safeParse(successResponse);
                expect(result.success).toBe(true);
            });

            it('should validate failed restructure response', () => {
                const failureResponse = {
                    success: false,
                    message: 'Restructure failed due to validation errors',
                    newTiers: [],
                    statistics: {
                        tiersCreated: 0,
                        tiersUpdated: 0,
                        tiersDeleted: 0,
                        processingTimeMs: 50
                    },
                    errors: [
                        {
                            index: 0,
                            error: 'Range overlap detected',
                            code: 'RANGE_OVERLAP'
                        }
                    ]
                };
                const result = PricingTierRestructureResponseSchema.safeParse(failureResponse);
                expect(result.success).toBe(true);
            });
        });
    });
});

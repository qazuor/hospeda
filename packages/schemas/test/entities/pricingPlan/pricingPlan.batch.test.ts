import { describe, expect, it } from 'vitest';
import {
    PricingPlanBatchCreateSchema,
    PricingPlanBatchDeleteSchema,
    PricingPlanBatchHardDeleteSchema,
    PricingPlanBatchOperationSchema,
    PricingPlanBatchRestoreSchema,
    PricingPlanBatchResultSchema,
    PricingPlanBatchUpdateSchema
} from '../../../src/entities/pricingPlan/pricingPlan.batch.schema.js';
import { BillingIntervalEnum } from '../../../src/enums/billing-interval.enum.js';
import { BillingSchemeEnum } from '../../../src/enums/billing-scheme.enum.js';

describe('PricingPlan Batch Schema', () => {
    describe('PricingPlanBatchCreateSchema', () => {
        it('should validate array of pricing plan creation data', () => {
            const batchCreateData = {
                items: [
                    {
                        productId: '123e4567-e89b-12d3-a456-426614174001',
                        billingScheme: BillingSchemeEnum.RECURRING,
                        interval: BillingIntervalEnum.MONTH,
                        amountMinor: 2999,
                        currency: 'USD',
                        metadata: { type: 'premium' }
                    },
                    {
                        productId: '123e4567-e89b-12d3-a456-426614174002',
                        billingScheme: BillingSchemeEnum.ONE_TIME,
                        amountMinor: 9999,
                        currency: 'EUR',
                        metadata: { type: 'standard' }
                    }
                ]
            };

            const result = PricingPlanBatchCreateSchema.safeParse(batchCreateData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.items).toHaveLength(2);
                expect(result.data.items[0]?.billingScheme).toBe(BillingSchemeEnum.RECURRING);
                expect(result.data.items[1]?.billingScheme).toBe(BillingSchemeEnum.ONE_TIME);
            }
        });

        it('should enforce maximum batch size', () => {
            const largeBatchData = {
                items: Array(101)
                    .fill(null)
                    .map((_, i) => ({
                        productId: `123e4567-e89b-12d3-a456-42661417400${i % 10}`,
                        billingScheme: BillingSchemeEnum.ONE_TIME,
                        amountMinor: 1000 + i,
                        currency: 'USD'
                    }))
            };

            const result = PricingPlanBatchCreateSchema.safeParse(largeBatchData);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingPlanBatchUpdateSchema', () => {
        it('should validate batch update with id and partial data', () => {
            const batchUpdateData = {
                items: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        amountMinor: 3499,
                        metadata: { updated: true }
                    },
                    {
                        id: '123e4567-e89b-12d3-a456-426614174001',
                        currency: 'GBP'
                    }
                ]
            };

            const result = PricingPlanBatchUpdateSchema.safeParse(batchUpdateData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.items).toHaveLength(2);
                expect(result.data.items[0]?.amountMinor).toBe(3499);
                expect(result.data.items[1]?.currency).toBe('GBP');
            }
        });

        it('should require at least one field to update besides id', () => {
            const emptyUpdateData = {
                items: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000'
                        // No update fields - this should fail validation
                    }
                ]
            };

            const result = PricingPlanBatchUpdateSchema.safeParse(emptyUpdateData);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(
                    result.error.issues.some((issue) =>
                        issue.message.includes('At least one field to update must be provided')
                    )
                ).toBe(true);
            }
        });
    });

    describe('PricingPlanBatchDeleteSchema', () => {
        it('should validate array of IDs for soft deletion', () => {
            const batchDeleteData = {
                ids: [
                    '123e4567-e89b-12d3-a456-426614174000',
                    '123e4567-e89b-12d3-a456-426614174001',
                    '123e4567-e89b-12d3-a456-426614174002'
                ]
            };

            const result = PricingPlanBatchDeleteSchema.safeParse(batchDeleteData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toHaveLength(3);
                expect(result.data.ids[0]).toMatch(/^[0-9a-f-]{36}$/i);
            }
        });

        it('should require at least one ID', () => {
            const emptyDeleteData = {
                ids: []
            };

            const result = PricingPlanBatchDeleteSchema.safeParse(emptyDeleteData);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingPlanBatchRestoreSchema', () => {
        it('should validate array of IDs for restoration', () => {
            const batchRestoreData = {
                ids: [
                    '123e4567-e89b-12d3-a456-426614174000',
                    '123e4567-e89b-12d3-a456-426614174001'
                ]
            };

            const result = PricingPlanBatchRestoreSchema.safeParse(batchRestoreData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toHaveLength(2);
            }
        });
    });

    describe('PricingPlanBatchHardDeleteSchema', () => {
        it('should validate array of IDs for permanent deletion', () => {
            const batchHardDeleteData = {
                ids: ['123e4567-e89b-12d3-a456-426614174000'],
                confirm: true
            };

            const result = PricingPlanBatchHardDeleteSchema.safeParse(batchHardDeleteData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.confirm).toBe(true);
            }
        });

        it('should require confirmation for hard delete', () => {
            const unconfirmedDeleteData = {
                ids: ['123e4567-e89b-12d3-a456-426614174000'],
                confirm: false
            };

            const result = PricingPlanBatchHardDeleteSchema.safeParse(unconfirmedDeleteData);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingPlanBatchOperationSchema', () => {
        it('should validate discriminated union for different operations', () => {
            const createOperation = {
                operation: 'create',
                data: {
                    items: [
                        {
                            productId: '123e4567-e89b-12d3-a456-426614174001',
                            billingScheme: BillingSchemeEnum.ONE_TIME,
                            amountMinor: 4999,
                            currency: 'USD'
                        }
                    ]
                }
            };

            const result = PricingPlanBatchOperationSchema.safeParse(createOperation);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.operation).toBe('create');
                if (result.data.operation === 'create') {
                    expect(result.data.data.items).toHaveLength(1);
                }
            }
        });
    });

    describe('PricingPlanBatchResultSchema', () => {
        it('should validate batch operation results', () => {
            const batchResult = {
                operation: 'create',
                successful: 2,
                failed: 1,
                total: 3,
                results: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        success: true
                    },
                    {
                        id: '123e4567-e89b-12d3-a456-426614174001',
                        success: true
                    },
                    {
                        id: '123e4567-e89b-12d3-a456-426614174002',
                        success: false,
                        error: 'Invalid billing scheme configuration'
                    }
                ]
            };

            const result = PricingPlanBatchResultSchema.safeParse(batchResult);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.successful).toBe(2);
                expect(result.data.failed).toBe(1);
                expect(result.data.results).toHaveLength(3);
            }
        });
    });
});

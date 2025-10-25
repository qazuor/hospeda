import { describe, expect, it } from 'vitest';
import {
    PricingPlanBulkCreateInputSchema,
    PricingPlanBulkDeleteInputSchema,
    PricingPlanBulkUpdateInputSchema,
    PricingPlanCreateInputSchema,
    PricingPlanDeleteSchema,
    PricingPlanRestoreSchema,
    PricingPlanUpdateInputSchema
} from '../../../src/entities/pricingPlan/pricingPlan.crud.schema.js';
import { BillingIntervalEnum } from '../../../src/enums/billing-interval.enum.js';
import { BillingSchemeEnum } from '../../../src/enums/billing-scheme.enum.js';

describe('PricingPlan CRUD Schema', () => {
    describe('PricingPlanCreateInputSchema', () => {
        it('should validate creation with RECURRING billing scheme', () => {
            const createInput = {
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.RECURRING,
                interval: BillingIntervalEnum.MONTH,
                amountMinor: 2999,
                currency: 'ARS'
            };

            const result = PricingPlanCreateInputSchema.safeParse(createInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.billingScheme).toBe(BillingSchemeEnum.RECURRING);
                expect(result.data.interval).toBe(BillingIntervalEnum.MONTH);
                expect(result.data.lifecycleState).toBe('ACTIVE'); // Default
                expect(result.data.metadata).toEqual({}); // Default
            }
        });

        it('should validate creation with ONE_TIME billing scheme', () => {
            const createInput = {
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.ONE_TIME,
                amountMinor: 9999,
                currency: 'USD'
            };

            const result = PricingPlanCreateInputSchema.safeParse(createInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.billingScheme).toBe(BillingSchemeEnum.ONE_TIME);
                expect(result.data.interval).toBeUndefined();
            }
        });

        it('should require interval for RECURRING billing scheme', () => {
            const invalidInput = {
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.RECURRING,
                // interval missing
                amountMinor: 2999,
                currency: 'ARS'
            };

            const result = PricingPlanCreateInputSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject interval for ONE_TIME billing scheme', () => {
            const invalidInput = {
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.ONE_TIME,
                interval: BillingIntervalEnum.MONTH, // Invalid for ONE_TIME
                amountMinor: 2999,
                currency: 'ARS'
            };

            const result = PricingPlanCreateInputSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should require positive amount', () => {
            const invalidInput = {
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.ONE_TIME,
                amountMinor: -1000, // Invalid
                currency: 'ARS'
            };

            const result = PricingPlanCreateInputSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingPlanUpdateInputSchema', () => {
        it('should allow partial updates', () => {
            const updateInput = {
                amountMinor: 3999,
                metadata: { updated: true }
            };

            const result = PricingPlanUpdateInputSchema.safeParse(updateInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amountMinor).toBe(3999);
                expect(result.data.metadata?.updated).toBe(true);
            }
        });

        it('should allow updating billing scheme to ONE_TIME (remove interval)', () => {
            const updateInput = {
                billingScheme: BillingSchemeEnum.ONE_TIME,
                interval: undefined // Explicitly remove interval
            };

            const result = PricingPlanUpdateInputSchema.safeParse(updateInput);
            expect(result.success).toBe(true);
        });

        it('should validate conditional interval requirement on update', () => {
            const invalidUpdate = {
                billingScheme: BillingSchemeEnum.RECURRING
                // interval required but missing
            };

            const result = PricingPlanUpdateInputSchema.safeParse(invalidUpdate);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingPlanDeleteSchema', () => {
        it('should validate delete with soft delete by default', () => {
            const deleteInput = {
                id: '123e4567-e89b-12d3-a456-426614174000'
            };

            const result = PricingPlanDeleteSchema.safeParse(deleteInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.permanent).toBe(false); // Default soft delete
            }
        });

        it('should validate hard delete when specified', () => {
            const deleteInput = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                permanent: true
            };

            const result = PricingPlanDeleteSchema.safeParse(deleteInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.permanent).toBe(true);
            }
        });
    });

    describe('PricingPlanRestoreSchema', () => {
        it('should validate restore operation', () => {
            const restoreInput = {
                id: '123e4567-e89b-12d3-a456-426614174000'
            };

            const result = PricingPlanRestoreSchema.safeParse(restoreInput);
            expect(result.success).toBe(true);
        });
    });

    describe('Bulk Operations', () => {
        it('should validate bulk create', () => {
            const bulkCreateInput = {
                items: [
                    {
                        productId: '987fcdeb-51a2-43d7-b123-456789012345',
                        billingScheme: BillingSchemeEnum.ONE_TIME,
                        amountMinor: 1999,
                        currency: 'USD'
                    },
                    {
                        productId: '111e1111-e11b-11d1-a111-111111111111',
                        billingScheme: BillingSchemeEnum.RECURRING,
                        interval: BillingIntervalEnum.YEAR,
                        amountMinor: 19999,
                        currency: 'EUR'
                    }
                ]
            };

            const result = PricingPlanBulkCreateInputSchema.safeParse(bulkCreateInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.items).toHaveLength(2);
                const firstItem = result.data.items[0];
                const secondItem = result.data.items[1];
                expect(firstItem?.billingScheme).toBe(BillingSchemeEnum.ONE_TIME);
                expect(secondItem?.billingScheme).toBe(BillingSchemeEnum.RECURRING);
            }
        });

        it('should validate bulk update', () => {
            const bulkUpdateInput = {
                items: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        amountMinor: 2499
                    },
                    {
                        id: '234e5678-e89b-12d3-a456-426614174001',
                        currency: 'GBP'
                    }
                ]
            };

            const result = PricingPlanBulkUpdateInputSchema.safeParse(bulkUpdateInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.items).toHaveLength(2);
            }
        });

        it('should validate bulk delete', () => {
            const bulkDeleteInput = {
                ids: [
                    '123e4567-e89b-12d3-a456-426614174000',
                    '234e5678-e89b-12d3-a456-426614174001'
                ],
                permanent: false
            };

            const result = PricingPlanBulkDeleteInputSchema.safeParse(bulkDeleteInput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toHaveLength(2);
                expect(result.data.permanent).toBe(false);
            }
        });
    });
});

import { describe, expect, it } from 'vitest';
import {
    PricingPlanMinimalSchema,
    PricingPlanNestedCreateSchema,
    PricingPlanNestedUpdateSchema,
    PricingPlanWithProductSchema
} from '../../../src/entities/pricingPlan/pricingPlan.relations.schema.js';
import { BillingIntervalEnum } from '../../../src/enums/billing-interval.enum.js';
import { BillingSchemeEnum } from '../../../src/enums/billing-scheme.enum.js';

describe('PricingPlan Relations Schema', () => {
    describe('PricingPlanWithProductSchema', () => {
        it('should validate pricing plan with product information', () => {
            const pricingPlanWithProduct = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                productId: '123e4567-e89b-12d3-a456-426614174001',
                billingScheme: BillingSchemeEnum.RECURRING,
                interval: BillingIntervalEnum.MONTH,
                amountMinor: 2999,
                currency: 'USD',
                metadata: { feature: 'premium' },
                lifecycleState: 'ACTIVE',
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '123e4567-e89b-12d3-a456-426614174002',
                updatedById: '123e4567-e89b-12d3-a456-426614174002',
                product: {
                    id: '123e4567-e89b-12d3-a456-426614174001',
                    name: 'Premium Room',
                    type: 'sponsorship',
                    description: 'Luxury accommodation with ocean view',
                    metadata: { stars: 5 },
                    lifecycleState: 'ACTIVE',
                    isActive: true,
                    isDeleted: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdById: '123e4567-e89b-12d3-a456-426614174002',
                    updatedById: '123e4567-e89b-12d3-a456-426614174002'
                }
            };

            const result = PricingPlanWithProductSchema.safeParse(pricingPlanWithProduct);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.product.name).toBe('Premium Room');
                expect(result.data.billingScheme).toBe(BillingSchemeEnum.RECURRING);
            }
        });

        it('should fail validation when product data is incomplete', () => {
            const invalidPricingPlan = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                productId: '123e4567-e89b-12d3-a456-426614174001',
                billingScheme: BillingSchemeEnum.ONE_TIME,
                amountMinor: 2999,
                currency: 'USD',
                metadata: {},
                lifecycleState: 'ACTIVE',
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '123e4567-e89b-12d3-a456-426614174002',
                updatedById: '123e4567-e89b-12d3-a456-426614174002',
                product: {
                    // Missing required fields
                    id: '123e4567-e89b-12d3-a456-426614174001'
                }
            };

            const result = PricingPlanWithProductSchema.safeParse(invalidPricingPlan);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingPlanMinimalSchema', () => {
        it('should validate minimal pricing plan data', () => {
            const minimalPricingPlan = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                billingScheme: BillingSchemeEnum.ONE_TIME,
                amountMinor: 4999,
                currency: 'GBP',
                lifecycleState: 'ACTIVE'
            };

            const result = PricingPlanMinimalSchema.safeParse(minimalPricingPlan);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.billingScheme).toBe(BillingSchemeEnum.ONE_TIME);
                expect(result.data.interval).toBeUndefined();
            }
        });

        it('should require interval for recurring billing scheme', () => {
            const recurringWithoutInterval = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                billingScheme: BillingSchemeEnum.RECURRING,
                amountMinor: 2999,
                currency: 'USD',
                lifecycleState: 'ACTIVE'
            };

            const result = PricingPlanMinimalSchema.safeParse(recurringWithoutInterval);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingPlanNestedCreateSchema', () => {
        it('should validate nested creation data', () => {
            const nestedCreateData = {
                billingScheme: BillingSchemeEnum.RECURRING,
                interval: BillingIntervalEnum.MONTH,
                amountMinor: 1999,
                currency: 'USD',
                metadata: { type: 'standard' },
                product: {
                    name: 'Standard Room',
                    type: 'sponsorship',
                    description: 'Comfortable accommodation'
                }
            };

            const result = PricingPlanNestedCreateSchema.safeParse(nestedCreateData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.product.name).toBe('Standard Room');
                expect(result.data.billingScheme).toBe(BillingSchemeEnum.RECURRING);
            }
        });

        it('should handle conditional billing scheme validation', () => {
            const oneTimeWithInterval = {
                billingScheme: BillingSchemeEnum.ONE_TIME,
                interval: BillingIntervalEnum.MONTH, // Should be invalid
                amountMinor: 5999,
                currency: 'EUR',
                product: {
                    name: 'Deluxe Suite',
                    type: 'sponsorship',
                    description: 'Premium suite'
                }
            };

            const result = PricingPlanNestedCreateSchema.safeParse(oneTimeWithInterval);
            expect(result.success).toBe(false);
        });
    });

    describe('PricingPlanNestedUpdateSchema', () => {
        it('should validate partial nested update data', () => {
            const nestedUpdateData = {
                amountMinor: 2499,
                metadata: { updated: true },
                product: {
                    name: 'Updated Room Name',
                    description: 'Updated description'
                }
            };

            const result = PricingPlanNestedUpdateSchema.safeParse(nestedUpdateData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.product?.name).toBe('Updated Room Name');
                expect(result.data.amountMinor).toBe(2499);
            }
        });

        it('should allow updating only pricing plan without product', () => {
            const updateOnlyPricing = {
                amountMinor: 3999,
                currency: 'CAD'
            };

            const result = PricingPlanNestedUpdateSchema.safeParse(updateOnlyPricing);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.product).toBeUndefined();
                expect(result.data.currency).toBe('CAD');
            }
        });
    });
});

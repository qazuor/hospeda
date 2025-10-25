import { describe, expect, it } from 'vitest';
import {
    PricingPlanIdSchema,
    PricingPlanSchema
} from '../../../src/entities/pricingPlan/pricingPlan.schema.js';
import { BillingIntervalEnum } from '../../../src/enums/billing-interval.enum.js';
import { BillingSchemeEnum } from '../../../src/enums/billing-scheme.enum.js';

describe('PricingPlan Schema', () => {
    describe('PricingPlanSchema', () => {
        it('should validate complete pricing plan with RECURRING scheme', () => {
            const validPricingPlan = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.RECURRING,
                interval: BillingIntervalEnum.MONTH,
                amountMinor: 2999,
                currency: 'ARS',
                isActive: true,
                isDeleted: false,
                lifecycleState: 'ACTIVE',
                createdAt: new Date('2024-01-15T10:00:00Z'),
                updatedAt: new Date('2024-01-15T10:00:00Z'),
                createdById: '111e1111-e11b-11d1-a111-111111111111',
                updatedById: '111e1111-e11b-11d1-a111-111111111111',
                metadata: { tier: 'basic', features: ['feature1'] }
            };

            const result = PricingPlanSchema.safeParse(validPricingPlan);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.billingScheme).toBe(BillingSchemeEnum.RECURRING);
                expect(result.data.interval).toBe(BillingIntervalEnum.MONTH);
                expect(result.data.amountMinor).toBe(2999);
                expect(result.data.currency).toBe('ARS');
            }
        });

        it('should validate pricing plan with ONE_TIME scheme (no interval)', () => {
            const oneTimePricingPlan = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.ONE_TIME,
                amountMinor: 9999,
                currency: 'USD',
                isActive: true,
                isDeleted: false,
                lifecycleState: 'ACTIVE',
                createdAt: new Date('2024-01-15T10:00:00Z'),
                updatedAt: new Date('2024-01-15T10:00:00Z'),
                createdById: '111e1111-e11b-11d1-a111-111111111111',
                updatedById: '111e1111-e11b-11d1-a111-111111111111',
                metadata: {}
            };

            const result = PricingPlanSchema.safeParse(oneTimePricingPlan);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.billingScheme).toBe(BillingSchemeEnum.ONE_TIME);
                expect(result.data.interval).toBeUndefined();
            }
        });

        it('should require interval when billingScheme is RECURRING', () => {
            const invalidPlan = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.RECURRING,
                // interval missing
                amountMinor: 2999,
                currency: 'ARS',
                isActive: true,
                isDeleted: false,
                lifecycleState: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '111e1111-e11b-11d1-a111-111111111111',
                updatedById: '111e1111-e11b-11d1-a111-111111111111',
                metadata: {}
            };

            const result = PricingPlanSchema.safeParse(invalidPlan);
            expect(result.success).toBe(false);
        });

        it('should reject interval when billingScheme is ONE_TIME', () => {
            const invalidPlan = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.ONE_TIME,
                interval: BillingIntervalEnum.MONTH, // Invalid for ONE_TIME
                amountMinor: 2999,
                currency: 'ARS',
                isActive: true,
                isDeleted: false,
                lifecycleState: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '111e1111-e11b-11d1-a111-111111111111',
                updatedById: '111e1111-e11b-11d1-a111-111111111111',
                metadata: {}
            };

            const result = PricingPlanSchema.safeParse(invalidPlan);
            expect(result.success).toBe(false);
        });

        it('should require positive amount', () => {
            const invalidPlan = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.ONE_TIME,
                amountMinor: -1000, // Invalid negative amount
                currency: 'ARS',
                isActive: true,
                isDeleted: false,
                lifecycleState: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '111e1111-e11b-11d1-a111-111111111111',
                updatedById: '111e1111-e11b-11d1-a111-111111111111',
                metadata: {}
            };

            const result = PricingPlanSchema.safeParse(invalidPlan);
            expect(result.success).toBe(false);
        });

        it('should validate currency code', () => {
            const validPlan = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                productId: '987fcdeb-51a2-43d7-b123-456789012345',
                billingScheme: BillingSchemeEnum.ONE_TIME,
                amountMinor: 1000,
                currency: 'EUR',
                isActive: true,
                isDeleted: false,
                lifecycleState: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '111e1111-e11b-11d1-a111-111111111111',
                updatedById: '111e1111-e11b-11d1-a111-111111111111',
                metadata: {}
            };

            const result = PricingPlanSchema.safeParse(validPlan);
            expect(result.success).toBe(true);
        });
    });

    describe('PricingPlanIdSchema', () => {
        it('should validate valid UUID', () => {
            const validId = '123e4567-e89b-12d3-a456-426614174000';
            const result = PricingPlanIdSchema.safeParse(validId);
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUID', () => {
            const invalidId = 'not-a-uuid';
            const result = PricingPlanIdSchema.safeParse(invalidId);
            expect(result.success).toBe(false);
        });
    });
});

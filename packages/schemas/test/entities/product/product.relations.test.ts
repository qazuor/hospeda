import { describe, expect, it } from 'vitest';
import {
    ProductRelationsListSchema,
    ProductRelationsSchema,
    ProductRelationsSummarySchema,
    ProductWithPricingPlansSchema
} from '../../../src/entities/product/product.relations.schema.js';

describe('Product Relations Schema', () => {
    describe('ProductWithPricingPlansSchema', () => {
        it('should validate product with pricing plans', () => {
            const productWithPlans = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Premium Sponsorship Package',
                type: 'sponsorship',
                description: 'Complete sponsorship solution',
                metadata: { tier: 'premium' },
                lifecycleState: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '12345678-1234-5678-9abc-123456789abc',
                updatedById: '12345678-1234-5678-9abc-123456789abc',
                isActive: true,
                isDeleted: false,
                pricingPlans: [
                    {
                        id: '456e7890-e12b-34d5-a678-901234567890',
                        name: 'Basic Plan',
                        productId: '123e4567-e89b-12d3-a456-426614174000',
                        isDefault: true,
                        lifecycleState: 'ACTIVE',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        createdById: '87654321-4321-8765-bcda-987654321fed',
                        updatedById: '87654321-4321-8765-bcda-987654321fed',
                        isActive: true,
                        isDeleted: false
                    }
                ]
            };

            const result = ProductWithPricingPlansSchema.safeParse(productWithPlans);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.pricingPlans).toHaveLength(1);
                const firstPlan = result.data.pricingPlans[0];
                expect(firstPlan?.name).toBe('Basic Plan');
                expect(firstPlan?.isDefault).toBe(true);
            }
        });

        it('should validate product with empty pricing plans', () => {
            const productWithoutPlans = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Campaign Package',
                type: 'campaign',
                lifecycleState: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '12345678-1234-5678-9abc-123456789abc',
                updatedById: '12345678-1234-5678-9abc-123456789abc',
                isActive: true,
                isDeleted: false,
                pricingPlans: []
            };

            const result = ProductWithPricingPlansSchema.safeParse(productWithoutPlans);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.pricingPlans).toHaveLength(0);
            }
        });
    });

    describe('ProductRelationsSchema', () => {
        it('should validate complete product relations', () => {
            const productRelations = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Premium Package',
                type: 'sponsorship',
                description: 'Premium sponsorship package',
                metadata: { tier: 'premium' },
                lifecycleState: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '12345678-1234-5678-9abc-123456789abc',
                updatedById: '12345678-1234-5678-9abc-123456789abc',
                isActive: true,
                isDeleted: false,
                pricingPlans: [
                    {
                        id: '456e7890-e12b-34d5-a678-901234567890',
                        name: 'Standard Plan',
                        productId: '123e4567-e89b-12d3-a456-426614174000',
                        isDefault: true,
                        lifecycleState: 'ACTIVE',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        createdById: '87654321-4321-8765-bcda-987654321fed',
                        updatedById: '87654321-4321-8765-bcda-987654321fed',
                        isActive: true,
                        isDeleted: false,
                        pricingTiers: [
                            {
                                id: '789e0123-e45f-6789-a901-234567890123',
                                name: 'Monthly Tier',
                                pricingPlanId: '456e7890-e12b-34d5-a678-901234567890',
                                currency: 'USD',
                                price: 99.99,
                                billingCycle: 'MONTHLY',
                                isDefault: true,
                                lifecycleState: 'ACTIVE',
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                createdById: 'abcdef01-2345-6789-abcd-ef0123456789',
                                updatedById: 'abcdef01-2345-6789-abcd-ef0123456789',
                                isActive: true,
                                isDeleted: false
                            }
                        ]
                    }
                ]
            };

            const result = ProductRelationsSchema.safeParse(productRelations);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.pricingPlans).toHaveLength(1);
                const firstPlan = result.data.pricingPlans[0];
                expect(firstPlan?.pricingTiers).toHaveLength(1);
                const firstTier = firstPlan?.pricingTiers?.[0];
                expect(firstTier?.price).toBe(99.99);
            }
        });
    });

    describe('ProductRelationsSummarySchema', () => {
        it('should validate product relations summary', () => {
            const summary = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Basic Package',
                type: 'campaign',
                isActive: true,
                pricingPlansCount: 3,
                pricingTiersCount: 8,
                defaultPlan: {
                    id: '456e7890-e12b-34d5-a678-901234567890',
                    name: 'Default Plan',
                    isDefault: true
                }
            };

            const result = ProductRelationsSummarySchema.safeParse(summary);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.pricingPlansCount).toBe(3);
                expect(result.data.pricingTiersCount).toBe(8);
                expect(result.data.defaultPlan?.name).toBe('Default Plan');
            }
        });

        it('should validate summary without default plan', () => {
            const summary = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Basic Package',
                type: 'campaign',
                isActive: true,
                pricingPlansCount: 0,
                pricingTiersCount: 0,
                defaultPlan: null
            };

            const result = ProductRelationsSummarySchema.safeParse(summary);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.pricingPlansCount).toBe(0);
                expect(result.data.defaultPlan).toBe(null);
            }
        });
    });

    describe('ProductRelationsListSchema', () => {
        it('should validate paginated product relations list', () => {
            const relationsList = {
                items: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        name: 'Package 1',
                        type: 'sponsorship',
                        isActive: true,
                        pricingPlansCount: 2,
                        pricingTiersCount: 6,
                        defaultPlan: {
                            id: '456e7890-e12b-34d5-a678-901234567890',
                            name: 'Standard Plan',
                            isDefault: true
                        }
                    }
                ],
                total: 1,
                page: 1,
                pageSize: 20,
                hasNextPage: false,
                hasPrevPage: false
            };

            const result = ProductRelationsListSchema.safeParse(relationsList);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.items).toHaveLength(1);
                expect(result.data.total).toBe(1);
                expect(result.data.hasNextPage).toBe(false);
            }
        });
    });
});

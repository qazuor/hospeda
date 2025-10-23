import { describe, expect, it } from 'vitest';
import {
    pricingPlanRelations,
    pricingPlans
} from '../../../src/schemas/catalog/pricingPlan.dbschema';

describe('PRICING_PLAN Database Schema', () => {
    describe('schema compilation', () => {
        it('should import pricingPlan schema without errors', () => {
            expect(pricingPlans).toBeDefined();
            expect(typeof pricingPlans).toBe('object');
        });

        it('should import pricingPlan relations without errors', () => {
            expect(pricingPlanRelations).toBeDefined();
            expect(typeof pricingPlanRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(pricingPlans).toBeDefined();
            expect(typeof pricingPlans).toBe('object');
            // Basic validation that it's a proper table definition
            expect(pricingPlans).toHaveProperty('id');
        });

        it('should have expected columns', () => {
            expect(pricingPlans).toHaveProperty('id');
            expect(pricingPlans).toHaveProperty('productId');
            expect(pricingPlans).toHaveProperty('billingScheme');
            expect(pricingPlans).toHaveProperty('interval');
            expect(pricingPlans).toHaveProperty('amountMinor');
            expect(pricingPlans).toHaveProperty('currency');
            expect(pricingPlans).toHaveProperty('createdAt');
            expect(pricingPlans).toHaveProperty('updatedAt');
            expect(pricingPlans).toHaveProperty('createdById');
            expect(pricingPlans).toHaveProperty('updatedById');
            expect(pricingPlans).toHaveProperty('deletedAt');
            expect(pricingPlans).toHaveProperty('deletedById');
            expect(pricingPlans).toHaveProperty('adminInfo');
        });
    });
});

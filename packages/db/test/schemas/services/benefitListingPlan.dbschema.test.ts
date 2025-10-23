import { describe, expect, it } from 'vitest';
import {
    benefitListingPlanRelations,
    benefitListingPlans
} from '../../../src/schemas/services/benefitListingPlan.dbschema';

describe('BENEFIT_LISTING_PLAN Database Schema - Etapa 2.10', () => {
    describe('schema compilation', () => {
        it('should import benefitListingPlan schema without errors', () => {
            expect(benefitListingPlans).toBeDefined();
            expect(typeof benefitListingPlans).toBe('object');
        });

        it('should import benefitListingPlan relations without errors', () => {
            expect(benefitListingPlanRelations).toBeDefined();
            expect(typeof benefitListingPlanRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(benefitListingPlans).toBeDefined();
            expect(typeof benefitListingPlans).toBe('object');
            // Basic validation that it's a proper table definition
            expect(benefitListingPlans).toHaveProperty('id');
        });

        it('should have expected columns for benefit listing plan', () => {
            expect(benefitListingPlans).toHaveProperty('id');
            expect(benefitListingPlans).toHaveProperty('name');
            expect(benefitListingPlans).toHaveProperty('description');
            expect(benefitListingPlans).toHaveProperty('limits');
            expect(benefitListingPlans).toHaveProperty('createdAt');
            expect(benefitListingPlans).toHaveProperty('updatedAt');
            expect(benefitListingPlans).toHaveProperty('createdById');
            expect(benefitListingPlans).toHaveProperty('updatedById');
            expect(benefitListingPlans).toHaveProperty('deletedAt');
            expect(benefitListingPlans).toHaveProperty('deletedById');
            expect(benefitListingPlans).toHaveProperty('adminInfo');
        });
    });
});

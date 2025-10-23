import { describe, expect, it } from 'vitest';
import {
    accommodationListingPlanRelations,
    accommodationListingPlans
} from '../../../src/schemas/accommodationListing/accommodationListingPlan.dbschema';

describe('ACCOMMODATION_LISTING_PLAN Database Schema - Etapa 2.9', () => {
    describe('schema compilation', () => {
        it('should import accommodation listing plan schema without errors', () => {
            expect(accommodationListingPlans).toBeDefined();
            expect(typeof accommodationListingPlans).toBe('object');
        });

        it('should import accommodation listing plan relations without errors', () => {
            expect(accommodationListingPlanRelations).toBeDefined();
            expect(typeof accommodationListingPlanRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(accommodationListingPlans).toBeDefined();
            expect(typeof accommodationListingPlans).toBe('object');
            // Basic validation that it's a proper table definition
            expect(accommodationListingPlans).toHaveProperty('id');
        });

        it('should have expected columns for accommodation listing plan', () => {
            expect(accommodationListingPlans).toHaveProperty('id');
            expect(accommodationListingPlans).toHaveProperty('name');
            expect(accommodationListingPlans).toHaveProperty('description');
            expect(accommodationListingPlans).toHaveProperty('price');
            expect(accommodationListingPlans).toHaveProperty('limits');
            expect(accommodationListingPlans).toHaveProperty('isActive');
            expect(accommodationListingPlans).toHaveProperty('isTrialAvailable');
            expect(accommodationListingPlans).toHaveProperty('trialDays');
            expect(accommodationListingPlans).toHaveProperty('createdAt');
            expect(accommodationListingPlans).toHaveProperty('updatedAt');
            expect(accommodationListingPlans).toHaveProperty('createdById');
            expect(accommodationListingPlans).toHaveProperty('updatedById');
            expect(accommodationListingPlans).toHaveProperty('deletedAt');
            expect(accommodationListingPlans).toHaveProperty('deletedById');
            expect(accommodationListingPlans).toHaveProperty('adminInfo');
        });
    });
});

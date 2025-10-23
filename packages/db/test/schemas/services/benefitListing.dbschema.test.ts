import { describe, expect, it } from 'vitest';
import {
    benefitListingRelations,
    benefitListings
} from '../../../src/schemas/services/benefitListing.dbschema';

describe('BENEFIT_LISTING Database Schema - Etapa 2.10', () => {
    describe('schema compilation', () => {
        it('should import benefitListing schema without errors', () => {
            expect(benefitListings).toBeDefined();
            expect(typeof benefitListings).toBe('object');
        });

        it('should import benefitListing relations without errors', () => {
            expect(benefitListingRelations).toBeDefined();
            expect(typeof benefitListingRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(benefitListings).toBeDefined();
            expect(typeof benefitListings).toBe('object');
            // Basic validation that it's a proper table definition
            expect(benefitListings).toHaveProperty('id');
        });

        it('should have expected columns for benefit listing', () => {
            expect(benefitListings).toHaveProperty('id');
            expect(benefitListings).toHaveProperty('benefitPartnerId');
            expect(benefitListings).toHaveProperty('listingPlanId');
            expect(benefitListings).toHaveProperty('title');
            expect(benefitListings).toHaveProperty('description');
            expect(benefitListings).toHaveProperty('startDate');
            expect(benefitListings).toHaveProperty('endDate');
            expect(benefitListings).toHaveProperty('trialStartDate');
            expect(benefitListings).toHaveProperty('trialEndDate');
            expect(benefitListings).toHaveProperty('isTrialPeriod');
            expect(benefitListings).toHaveProperty('status');
            expect(benefitListings).toHaveProperty('benefitDetails');
            expect(benefitListings).toHaveProperty('createdAt');
            expect(benefitListings).toHaveProperty('updatedAt');
            expect(benefitListings).toHaveProperty('createdById');
            expect(benefitListings).toHaveProperty('updatedById');
            expect(benefitListings).toHaveProperty('deletedAt');
            expect(benefitListings).toHaveProperty('deletedById');
            expect(benefitListings).toHaveProperty('adminInfo');
        });
    });
});

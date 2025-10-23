import { describe, expect, it } from 'vitest';
import {
    accommodationListingRelations,
    accommodationListings
} from '../../../src/schemas/accommodationListing/accommodationListing.dbschema';

describe('ACCOMMODATION_LISTING Database Schema - Etapa 2.9', () => {
    describe('schema compilation', () => {
        it('should import accommodation listing schema without errors', () => {
            expect(accommodationListings).toBeDefined();
            expect(typeof accommodationListings).toBe('object');
        });

        it('should import accommodation listing relations without errors', () => {
            expect(accommodationListingRelations).toBeDefined();
            expect(typeof accommodationListingRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(accommodationListings).toBeDefined();
            expect(typeof accommodationListings).toBe('object');
            // Basic validation that it's a proper table definition
            expect(accommodationListings).toHaveProperty('id');
        });

        it('should have expected columns for accommodation listing', () => {
            expect(accommodationListings).toHaveProperty('id');
            expect(accommodationListings).toHaveProperty('clientId');
            expect(accommodationListings).toHaveProperty('accommodationId');
            expect(accommodationListings).toHaveProperty('listingPlanId');
            expect(accommodationListings).toHaveProperty('title');
            expect(accommodationListings).toHaveProperty('description');
            expect(accommodationListings).toHaveProperty('status');
            expect(accommodationListings).toHaveProperty('isTrialActive');
            expect(accommodationListings).toHaveProperty('trialStartsAt');
            expect(accommodationListings).toHaveProperty('trialEndsAt');
            expect(accommodationListings).toHaveProperty('startsAt');
            expect(accommodationListings).toHaveProperty('endsAt');
            expect(accommodationListings).toHaveProperty('customConfig');
            expect(accommodationListings).toHaveProperty('createdAt');
            expect(accommodationListings).toHaveProperty('updatedAt');
            expect(accommodationListings).toHaveProperty('createdById');
            expect(accommodationListings).toHaveProperty('updatedById');
            expect(accommodationListings).toHaveProperty('deletedAt');
            expect(accommodationListings).toHaveProperty('deletedById');
            expect(accommodationListings).toHaveProperty('adminInfo');
        });
    });
});

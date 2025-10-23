import { describe, expect, it } from 'vitest';
import {
    featuredAccommodationRelations,
    featuredAccommodations
} from '../../../src/schemas/marketing/featuredAccommodation.dbschema';

describe('FEATURED_ACCOMMODATION Database Schema', () => {
    describe('schema compilation', () => {
        it('should import featuredAccommodation schema without errors', () => {
            expect(featuredAccommodations).toBeDefined();
            expect(typeof featuredAccommodations).toBe('object');
        });

        it('should import featuredAccommodation relations without errors', () => {
            expect(featuredAccommodationRelations).toBeDefined();
            expect(typeof featuredAccommodationRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(featuredAccommodations).toBeDefined();
            expect(typeof featuredAccommodations).toBe('object');
            // Basic validation that it's a proper table definition
            expect(featuredAccommodations).toHaveProperty('id');
        });

        it('should have expected columns for featured accommodation', () => {
            expect(featuredAccommodations).toHaveProperty('id');
            expect(featuredAccommodations).toHaveProperty('clientId');
            expect(featuredAccommodations).toHaveProperty('accommodationId');
            expect(featuredAccommodations).toHaveProperty('featuredType');
            expect(featuredAccommodations).toHaveProperty('fromDate');
            expect(featuredAccommodations).toHaveProperty('toDate');
            expect(featuredAccommodations).toHaveProperty('status');
            expect(featuredAccommodations).toHaveProperty('createdAt');
            expect(featuredAccommodations).toHaveProperty('updatedAt');
            expect(featuredAccommodations).toHaveProperty('createdById');
            expect(featuredAccommodations).toHaveProperty('updatedById');
            expect(featuredAccommodations).toHaveProperty('deletedAt');
            expect(featuredAccommodations).toHaveProperty('deletedById');
            expect(featuredAccommodations).toHaveProperty('adminInfo');
        });
    });
});

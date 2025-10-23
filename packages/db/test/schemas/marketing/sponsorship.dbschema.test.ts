import { describe, expect, it } from 'vitest';
import {
    sponsorshipRelations,
    sponsorships
} from '../../../src/schemas/marketing/sponsorship.dbschema';

describe('SPONSORSHIP Database Schema', () => {
    describe('schema compilation', () => {
        it('should import sponsorship schema without errors', () => {
            expect(sponsorships).toBeDefined();
            expect(typeof sponsorships).toBe('object');
        });

        it('should import sponsorship relations without errors', () => {
            expect(sponsorshipRelations).toBeDefined();
            expect(typeof sponsorshipRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(sponsorships).toBeDefined();
            expect(typeof sponsorships).toBe('object');
            // Basic validation that it's a proper table definition
            expect(sponsorships).toHaveProperty('id');
        });

        it('should have expected columns for sponsorship', () => {
            expect(sponsorships).toHaveProperty('id');
            expect(sponsorships).toHaveProperty('clientId');
            expect(sponsorships).toHaveProperty('entityType');
            expect(sponsorships).toHaveProperty('entityId');
            expect(sponsorships).toHaveProperty('fromDate');
            expect(sponsorships).toHaveProperty('toDate');
            expect(sponsorships).toHaveProperty('status');
            expect(sponsorships).toHaveProperty('createdAt');
            expect(sponsorships).toHaveProperty('updatedAt');
            expect(sponsorships).toHaveProperty('createdById');
            expect(sponsorships).toHaveProperty('updatedById');
            expect(sponsorships).toHaveProperty('deletedAt');
            expect(sponsorships).toHaveProperty('deletedById');
            expect(sponsorships).toHaveProperty('adminInfo');
        });
    });
});

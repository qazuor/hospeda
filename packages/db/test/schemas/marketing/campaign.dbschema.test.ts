import { describe, expect, it } from 'vitest';
import { campaignRelations, campaigns } from '../../../src/schemas/marketing/campaign.dbschema';

describe('CAMPAIGN Database Schema', () => {
    describe('schema compilation', () => {
        it('should import campaign schema without errors', () => {
            expect(campaigns).toBeDefined();
            expect(typeof campaigns).toBe('object');
        });

        it('should import campaign relations without errors', () => {
            expect(campaignRelations).toBeDefined();
            expect(typeof campaignRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(campaigns).toBeDefined();
            expect(typeof campaigns).toBe('object');
            // Basic validation that it's a proper table definition
            expect(campaigns).toHaveProperty('id');
        });

        it('should have expected columns for campaign', () => {
            expect(campaigns).toHaveProperty('id');
            expect(campaigns).toHaveProperty('clientId');
            expect(campaigns).toHaveProperty('name');
            expect(campaigns).toHaveProperty('channel');
            expect(campaigns).toHaveProperty('fromDate');
            expect(campaigns).toHaveProperty('toDate');
            expect(campaigns).toHaveProperty('status');
            expect(campaigns).toHaveProperty('createdAt');
            expect(campaigns).toHaveProperty('updatedAt');
            expect(campaigns).toHaveProperty('createdById');
            expect(campaigns).toHaveProperty('updatedById');
            expect(campaigns).toHaveProperty('deletedAt');
            expect(campaigns).toHaveProperty('deletedById');
            expect(campaigns).toHaveProperty('adminInfo');
        });
    });
});

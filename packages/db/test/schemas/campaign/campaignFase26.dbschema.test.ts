import { describe, expect, it } from 'vitest';
import {
    campaignFase26Relations,
    campaignsFase26
} from '../../../src/schemas/campaign/campaignFase26.dbschema';

describe('CAMPAIGN Database Schema - Fase 2.6', () => {
    describe('schema compilation', () => {
        it('should import campaign schema without errors', () => {
            expect(campaignsFase26).toBeDefined();
            expect(typeof campaignsFase26).toBe('object');
        });

        it('should import campaign relations without errors', () => {
            expect(campaignFase26Relations).toBeDefined();
            expect(typeof campaignFase26Relations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(campaignsFase26).toBeDefined();
            expect(typeof campaignsFase26).toBe('object');
            // Basic validation that it's a proper table definition
            expect(campaignsFase26).toHaveProperty('id');
        });

        it('should have expected columns for campaign', () => {
            expect(campaignsFase26).toHaveProperty('id');
            expect(campaignsFase26).toHaveProperty('clientId');
            expect(campaignsFase26).toHaveProperty('name');
            expect(campaignsFase26).toHaveProperty('channel');
            expect(campaignsFase26).toHaveProperty('fromDate');
            expect(campaignsFase26).toHaveProperty('toDate');
            expect(campaignsFase26).toHaveProperty('status');
            expect(campaignsFase26).toHaveProperty('createdAt');
            expect(campaignsFase26).toHaveProperty('updatedAt');
            expect(campaignsFase26).toHaveProperty('createdById');
            expect(campaignsFase26).toHaveProperty('updatedById');
            expect(campaignsFase26).toHaveProperty('deletedAt');
            expect(campaignsFase26).toHaveProperty('deletedById');
            expect(campaignsFase26).toHaveProperty('adminInfo');
        });
    });
});

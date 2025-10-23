import { describe, expect, it } from 'vitest';
import { adSlotRelations, adSlots } from '../../../src/schemas/campaign/adSlot.dbschema';

describe('AD_SLOT Database Schema - Fase 2.6', () => {
    describe('schema compilation', () => {
        it('should import adSlot schema without errors', () => {
            expect(adSlots).toBeDefined();
            expect(typeof adSlots).toBe('object');
        });

        it('should import adSlot relations without errors', () => {
            expect(adSlotRelations).toBeDefined();
            expect(typeof adSlotRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(adSlots).toBeDefined();
            expect(typeof adSlots).toBe('object');
            // Basic validation that it's a proper table definition
            expect(adSlots).toHaveProperty('id');
        });

        it('should have expected columns for ad slot', () => {
            expect(adSlots).toHaveProperty('id');
            expect(adSlots).toHaveProperty('locationKey');
            expect(adSlots).toHaveProperty('specs');
            expect(adSlots).toHaveProperty('isActive');
            expect(adSlots).toHaveProperty('createdAt');
            expect(adSlots).toHaveProperty('updatedAt');
            expect(adSlots).toHaveProperty('createdById');
            expect(adSlots).toHaveProperty('updatedById');
            expect(adSlots).toHaveProperty('deletedAt');
            expect(adSlots).toHaveProperty('deletedById');
            expect(adSlots).toHaveProperty('adminInfo');
        });
    });
});

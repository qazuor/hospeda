import { describe, expect, it } from 'vitest';
import {
    adSlotReservationRelations,
    adSlotReservations
} from '../../../src/schemas/campaign/adSlotReservation.dbschema';

describe('AD_SLOT_RESERVATION Database Schema - Fase 2.6', () => {
    describe('schema compilation', () => {
        it('should import adSlotReservation schema without errors', () => {
            expect(adSlotReservations).toBeDefined();
            expect(typeof adSlotReservations).toBe('object');
        });

        it('should import adSlotReservation relations without errors', () => {
            expect(adSlotReservationRelations).toBeDefined();
            expect(typeof adSlotReservationRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(adSlotReservations).toBeDefined();
            expect(typeof adSlotReservations).toBe('object');
            // Basic validation that it's a proper table definition
            expect(adSlotReservations).toHaveProperty('id');
        });

        it('should have expected columns for ad slot reservation', () => {
            expect(adSlotReservations).toHaveProperty('id');
            expect(adSlotReservations).toHaveProperty('adSlotId');
            expect(adSlotReservations).toHaveProperty('campaignId');
            expect(adSlotReservations).toHaveProperty('fromDate');
            expect(adSlotReservations).toHaveProperty('toDate');
            expect(adSlotReservations).toHaveProperty('status');
            expect(adSlotReservations).toHaveProperty('createdAt');
            expect(adSlotReservations).toHaveProperty('updatedAt');
            expect(adSlotReservations).toHaveProperty('createdById');
            expect(adSlotReservations).toHaveProperty('updatedById');
            expect(adSlotReservations).toHaveProperty('deletedAt');
            expect(adSlotReservations).toHaveProperty('deletedById');
            expect(adSlotReservations).toHaveProperty('adminInfo');
        });
    });
});

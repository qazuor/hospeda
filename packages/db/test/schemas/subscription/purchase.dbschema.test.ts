import { describe, expect, it } from 'vitest';
import { purchaseRelations, purchases } from '../../../src/schemas/subscription/purchase.dbschema';

describe('PURCHASE Database Schema', () => {
    describe('schema compilation', () => {
        it('should import purchase schema without errors', () => {
            expect(purchases).toBeDefined();
            expect(typeof purchases).toBe('object');
        });

        it('should import purchase relations without errors', () => {
            expect(purchaseRelations).toBeDefined();
            expect(typeof purchaseRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(purchases).toBeDefined();
            expect(typeof purchases).toBe('object');
            // Basic validation that it's a proper table definition
            expect(purchases).toHaveProperty('id');
        });

        it('should have expected columns', () => {
            expect(purchases).toHaveProperty('id');
            expect(purchases).toHaveProperty('clientId');
            expect(purchases).toHaveProperty('pricingPlanId');
            expect(purchases).toHaveProperty('purchasedAt');
            expect(purchases).toHaveProperty('createdAt');
            expect(purchases).toHaveProperty('updatedAt');
            expect(purchases).toHaveProperty('createdById');
            expect(purchases).toHaveProperty('updatedById');
            expect(purchases).toHaveProperty('deletedAt');
            expect(purchases).toHaveProperty('deletedById');
            expect(purchases).toHaveProperty('adminInfo');
        });
    });
});

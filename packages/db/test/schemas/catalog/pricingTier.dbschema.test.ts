import { describe, expect, it } from 'vitest';
import {
    pricingTierRelations,
    pricingTiers
} from '../../../src/schemas/catalog/pricingTier.dbschema';

describe('PRICING_TIER Database Schema', () => {
    describe('schema compilation', () => {
        it('should import pricingTier schema without errors', () => {
            expect(pricingTiers).toBeDefined();
            expect(typeof pricingTiers).toBe('object');
        });

        it('should import pricingTier relations without errors', () => {
            expect(pricingTierRelations).toBeDefined();
            expect(typeof pricingTierRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(pricingTiers).toBeDefined();
            expect(typeof pricingTiers).toBe('object');
            // Basic validation that it's a proper table definition
            expect(pricingTiers).toHaveProperty('id');
        });

        it('should have expected columns', () => {
            expect(pricingTiers).toHaveProperty('id');
            expect(pricingTiers).toHaveProperty('pricingPlanId');
            expect(pricingTiers).toHaveProperty('minQuantity');
            expect(pricingTiers).toHaveProperty('maxQuantity');
            expect(pricingTiers).toHaveProperty('unitPriceMinor');
            expect(pricingTiers).toHaveProperty('createdAt');
            expect(pricingTiers).toHaveProperty('updatedAt');
            expect(pricingTiers).toHaveProperty('createdById');
            expect(pricingTiers).toHaveProperty('updatedById');
            expect(pricingTiers).toHaveProperty('deletedAt');
            expect(pricingTiers).toHaveProperty('deletedById');
            expect(pricingTiers).toHaveProperty('adminInfo');
        });
    });
});

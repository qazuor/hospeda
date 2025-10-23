import { describe, expect, it } from 'vitest';
import {
    subscriptionItemRelations,
    subscriptionItems
} from '../../../src/schemas/subscription/subscriptionItem.dbschema';

describe('SUBSCRIPTION_ITEM Database Schema', () => {
    describe('schema compilation', () => {
        it('should import subscriptionItem schema without errors', () => {
            expect(subscriptionItems).toBeDefined();
            expect(typeof subscriptionItems).toBe('object');
        });

        it('should import subscriptionItem relations without errors', () => {
            expect(subscriptionItemRelations).toBeDefined();
            expect(typeof subscriptionItemRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(subscriptionItems).toBeDefined();
            expect(typeof subscriptionItems).toBe('object');
            // Basic validation that it's a proper table definition
            expect(subscriptionItems).toHaveProperty('id');
        });

        it('should have expected columns for polymorphic system', () => {
            expect(subscriptionItems).toHaveProperty('id');
            expect(subscriptionItems).toHaveProperty('sourceId');
            expect(subscriptionItems).toHaveProperty('sourceType');
            expect(subscriptionItems).toHaveProperty('linkedEntityId');
            expect(subscriptionItems).toHaveProperty('entityType');
            expect(subscriptionItems).toHaveProperty('createdAt');
            expect(subscriptionItems).toHaveProperty('updatedAt');
            expect(subscriptionItems).toHaveProperty('createdById');
            expect(subscriptionItems).toHaveProperty('updatedById');
            expect(subscriptionItems).toHaveProperty('deletedAt');
            expect(subscriptionItems).toHaveProperty('deletedById');
            expect(subscriptionItems).toHaveProperty('adminInfo');
        });
    });
});

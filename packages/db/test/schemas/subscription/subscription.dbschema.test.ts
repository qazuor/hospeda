import { describe, expect, it } from 'vitest';
import {
    subscriptionRelations,
    subscriptions
} from '../../../src/schemas/subscription/subscription.dbschema';

describe('SUBSCRIPTION Database Schema', () => {
    describe('schema compilation', () => {
        it('should import subscription schema without errors', () => {
            expect(subscriptions).toBeDefined();
            expect(typeof subscriptions).toBe('object');
        });

        it('should import subscription relations without errors', () => {
            expect(subscriptionRelations).toBeDefined();
            expect(typeof subscriptionRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(subscriptions).toBeDefined();
            expect(typeof subscriptions).toBe('object');
            // Basic validation that it's a proper table definition
            expect(subscriptions).toHaveProperty('id');
        });

        it('should have expected columns', () => {
            expect(subscriptions).toHaveProperty('id');
            expect(subscriptions).toHaveProperty('clientId');
            expect(subscriptions).toHaveProperty('pricingPlanId');
            expect(subscriptions).toHaveProperty('status');
            expect(subscriptions).toHaveProperty('startAt');
            expect(subscriptions).toHaveProperty('endAt');
            expect(subscriptions).toHaveProperty('trialEndsAt');
            expect(subscriptions).toHaveProperty('createdAt');
            expect(subscriptions).toHaveProperty('updatedAt');
            expect(subscriptions).toHaveProperty('createdById');
            expect(subscriptions).toHaveProperty('updatedById');
            expect(subscriptions).toHaveProperty('deletedAt');
            expect(subscriptions).toHaveProperty('deletedById');
            expect(subscriptions).toHaveProperty('adminInfo');
        });
    });
});

import { describe, expect, it } from 'vitest';
import { SubscriptionStatusEnum } from '../../enums/subscription-status.enum.js';
import { SubscriptionSchema } from './subscription.schema.js';

describe('SubscriptionSchema', () => {
    it('should validate a valid subscription', () => {
        const validSubscription = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            pricingPlanId: '550e8400-e29b-41d4-a716-446655440002',
            status: SubscriptionStatusEnum.ACTIVE,
            startAt: new Date('2024-01-01T00:00:00Z'),
            endAt: new Date('2024-12-31T23:59:59Z'),
            trialEndsAt: new Date('2024-01-07T23:59:59Z'),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: '550e8400-e29b-41d4-a716-446655440003',
            updatedById: '550e8400-e29b-41d4-a716-446655440003',
            // deletedAt and deletedById not included - should be optional
            adminInfo: { notes: 'Test subscription' }
        };

        const result = SubscriptionSchema.safeParse(validSubscription);
        expect(result.success).toBe(true);
    });

    it('should require all mandatory fields', () => {
        const invalidSubscription = {};

        const result = SubscriptionSchema.safeParse(invalidSubscription);
        expect(result.success).toBe(false);
        if (!result.success) {
            const fieldErrors = result.error.issues.map((issue) => issue.path[0]);
            expect(fieldErrors).toContain('id');
            expect(fieldErrors).toContain('clientId');
            expect(fieldErrors).toContain('pricingPlanId');
            expect(fieldErrors).toContain('status');
            expect(fieldErrors).toContain('startAt');
        }
    });

    it('should validate trial end date before end date when both present', () => {
        const subscriptionWithInvalidTrial = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            pricingPlanId: '550e8400-e29b-41d4-a716-446655440002',
            status: SubscriptionStatusEnum.ACTIVE,
            startAt: new Date('2024-01-01T00:00:00Z'),
            endAt: new Date('2024-01-07T23:59:59Z'),
            trialEndsAt: new Date('2024-01-15T23:59:59Z'), // After end date
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: '550e8400-e29b-41d4-a716-446655440003',
            updatedById: '550e8400-e29b-41d4-a716-446655440003'
        };

        const result = SubscriptionSchema.safeParse(subscriptionWithInvalidTrial);
        expect(result.success).toBe(false);
    });

    it('should allow null optional fields', () => {
        const subscriptionWithNulls = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            pricingPlanId: '550e8400-e29b-41d4-a716-446655440002',
            status: SubscriptionStatusEnum.ACTIVE,
            startAt: new Date('2024-01-01T00:00:00Z'),
            endAt: null,
            trialEndsAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: '550e8400-e29b-41d4-a716-446655440003',
            updatedById: '550e8400-e29b-41d4-a716-446655440003',
            // deletedAt and deletedById should be optional
            adminInfo: null
        };

        const result = SubscriptionSchema.safeParse(subscriptionWithNulls);
        expect(result.success).toBe(true);
    });
});

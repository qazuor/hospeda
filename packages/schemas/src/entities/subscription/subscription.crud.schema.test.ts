import { describe, expect, it } from 'vitest';
import { SubscriptionStatusEnum } from '../../enums/subscription-status.enum.js';
import {
    SubscriptionCreateInputSchema,
    SubscriptionStatusUpdateSchema,
    SubscriptionUpdateInputSchema
} from './subscription.crud.schema.js';

describe('SubscriptionCreateInputSchema', () => {
    it('should validate a valid create input', () => {
        const validInput = {
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            pricingPlanId: '550e8400-e29b-41d4-a716-446655440002',
            startAt: new Date('2024-01-01'),
            createdById: '550e8400-e29b-41d4-a716-446655440003',
            updatedById: '550e8400-e29b-41d4-a716-446655440003'
        };

        const result = SubscriptionCreateInputSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe(SubscriptionStatusEnum.ACTIVE); // Default value
        }
    });

    it('should set default status and startAt', () => {
        const minimalInput = {
            clientId: '550e8400-e29b-41d4-a716-446655440001',
            pricingPlanId: '550e8400-e29b-41d4-a716-446655440002',
            createdById: '550e8400-e29b-41d4-a716-446655440003',
            updatedById: '550e8400-e29b-41d4-a716-446655440003'
        };

        const result = SubscriptionCreateInputSchema.safeParse(minimalInput);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBe(SubscriptionStatusEnum.ACTIVE);
            expect(result.data.startAt).toBeInstanceOf(Date);
        }
    });

    it('should require mandatory fields', () => {
        const invalidInput = {};

        const result = SubscriptionCreateInputSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
    });
});

describe('SubscriptionUpdateInputSchema', () => {
    it('should validate a valid update input', () => {
        const validUpdate = {
            status: SubscriptionStatusEnum.CANCELLED,
            endAt: new Date('2024-12-31'),
            updatedById: '550e8400-e29b-41d4-a716-446655440003'
        };

        const result = SubscriptionUpdateInputSchema.safeParse(validUpdate);
        expect(result.success).toBe(true);
    });

    it('should allow partial updates', () => {
        const partialUpdate = {
            status: SubscriptionStatusEnum.PAUSED,
            updatedById: '550e8400-e29b-41d4-a716-446655440003'
        };

        const result = SubscriptionUpdateInputSchema.safeParse(partialUpdate);
        expect(result.success).toBe(true);
    });

    it('should require updatedById', () => {
        const invalidUpdate = {
            status: SubscriptionStatusEnum.CANCELLED
        };

        const result = SubscriptionUpdateInputSchema.safeParse(invalidUpdate);
        expect(result.success).toBe(false);
    });
});

describe('SubscriptionStatusUpdateSchema', () => {
    it('should validate a valid status update', () => {
        const validStatusUpdate = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            status: SubscriptionStatusEnum.CANCELLED,
            updatedById: '550e8400-e29b-41d4-a716-446655440003'
        };

        const result = SubscriptionStatusUpdateSchema.safeParse(validStatusUpdate);
        expect(result.success).toBe(true);
    });

    it('should require all fields', () => {
        const invalidStatusUpdate = {
            id: '550e8400-e29b-41d4-a716-446655440000'
        };

        const result = SubscriptionStatusUpdateSchema.safeParse(invalidStatusUpdate);
        expect(result.success).toBe(false);
    });
});

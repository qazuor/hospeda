import { describe, expect, it } from 'vitest';
import type { ZodIssue } from 'zod';
import { SubscriptionItemEntityTypeEnum } from '../../enums/subscription-item-entity-type.enum.js';
import { SubscriptionItemSourceTypeEnum } from '../../enums/subscription-item-source-type.enum.js';
import { SubscriptionItemSchema } from './subscriptionItem.schema.js';

describe('SubscriptionItemSchema', () => {
    it('should validate a valid subscription item', () => {
        const validSubscriptionItem = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            sourceId: '550e8400-e29b-41d4-a716-446655440001', // subscription or purchase ID
            sourceType: SubscriptionItemSourceTypeEnum.SUBSCRIPTION,
            linkedEntityId: '550e8400-e29b-41d4-a716-446655440002', // target entity ID
            entityType: SubscriptionItemEntityTypeEnum.SPONSORSHIP,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: '550e8400-e29b-41d4-a716-446655440003',
            updatedById: '550e8400-e29b-41d4-a716-446655440003',
            adminInfo: { notes: 'Test subscription item' }
        };

        const result = SubscriptionItemSchema.safeParse(validSubscriptionItem);
        expect(result.success).toBe(true);
    });

    it('should require all mandatory polymorphic fields', () => {
        const invalidSubscriptionItem = {};

        const result = SubscriptionItemSchema.safeParse(invalidSubscriptionItem);
        expect(result.success).toBe(false);
        if (!result.success) {
            const fieldErrors = result.error.issues.map((issue: ZodIssue) => issue.path[0]);
            expect(fieldErrors).toContain('id');
            expect(fieldErrors).toContain('sourceId');
            expect(fieldErrors).toContain('sourceType');
            expect(fieldErrors).toContain('linkedEntityId');
            expect(fieldErrors).toContain('entityType');
        }
    });

    it('should validate sourceType enum values', () => {
        const invalidSourceType = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            sourceId: '550e8400-e29b-41d4-a716-446655440001',
            sourceType: 'INVALID_SOURCE',
            linkedEntityId: '550e8400-e29b-41d4-a716-446655440002',
            entityType: SubscriptionItemEntityTypeEnum.SPONSORSHIP,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: '550e8400-e29b-41d4-a716-446655440003',
            updatedById: '550e8400-e29b-41d4-a716-446655440003'
        };

        const result = SubscriptionItemSchema.safeParse(invalidSourceType);
        expect(result.success).toBe(false);
    });

    it('should validate entityType enum values', () => {
        const invalidEntityType = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            sourceId: '550e8400-e29b-41d4-a716-446655440001',
            sourceType: SubscriptionItemSourceTypeEnum.SUBSCRIPTION,
            linkedEntityId: '550e8400-e29b-41d4-a716-446655440002',
            entityType: 'INVALID_ENTITY',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: '550e8400-e29b-41d4-a716-446655440003',
            updatedById: '550e8400-e29b-41d4-a716-446655440003'
        };

        const result = SubscriptionItemSchema.safeParse(invalidEntityType);
        expect(result.success).toBe(false);
    });

    it('should validate all valid entity types', () => {
        const validEntityTypes = [
            SubscriptionItemEntityTypeEnum.SPONSORSHIP,
            SubscriptionItemEntityTypeEnum.CAMPAIGN,
            SubscriptionItemEntityTypeEnum.FEATURED_ACCOMMODATION,
            SubscriptionItemEntityTypeEnum.PROFESSIONAL_SERVICE_ORDER,
            SubscriptionItemEntityTypeEnum.ACCOMMODATION_LISTING,
            SubscriptionItemEntityTypeEnum.BENEFIT_LISTING,
            SubscriptionItemEntityTypeEnum.SERVICE_LISTING
        ];

        for (const entityType of validEntityTypes) {
            const subscriptionItem = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                sourceId: '550e8400-e29b-41d4-a716-446655440001',
                sourceType: SubscriptionItemSourceTypeEnum.SUBSCRIPTION,
                linkedEntityId: '550e8400-e29b-41d4-a716-446655440002',
                entityType,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003'
            };

            const result = SubscriptionItemSchema.safeParse(subscriptionItem);
            expect(result.success).toBe(true);
        }
    });

    it('should validate both source types', () => {
        const sourceTypes = [
            SubscriptionItemSourceTypeEnum.SUBSCRIPTION,
            SubscriptionItemSourceTypeEnum.PURCHASE
        ];

        for (const sourceType of sourceTypes) {
            const subscriptionItem = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                sourceId: '550e8400-e29b-41d4-a716-446655440001',
                sourceType,
                linkedEntityId: '550e8400-e29b-41d4-a716-446655440002',
                entityType: SubscriptionItemEntityTypeEnum.SPONSORSHIP,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003'
            };

            const result = SubscriptionItemSchema.safeParse(subscriptionItem);
            expect(result.success).toBe(true);
        }
    });
});

import { describe, expect, it } from 'vitest';
import { SubscriptionItemEntityTypeEnum } from '../../enums/subscription-item-entity-type.enum.js';
import { SubscriptionItemSourceTypeEnum } from '../../enums/subscription-item-source-type.enum.js';
import {
    SubscriptionItemCreateInputSchema,
    SubscriptionItemPolymorphicValidationSchema
} from './subscriptionItem.crud.schema.js';
import {
    SubscriptionItemByEntityQuerySchema,
    SubscriptionItemBySourceQuerySchema,
    SubscriptionItemQuerySchema
} from './subscriptionItem.query.schema.js';

describe('SubscriptionItem Polymorphic System Tests', () => {
    describe('sourceType × entityType Combinations', () => {
        const allSourceTypes = Object.values(SubscriptionItemSourceTypeEnum);
        const allEntityTypes = Object.values(SubscriptionItemEntityTypeEnum);

        it('should validate all valid sourceType × entityType combinations', () => {
            for (const sourceType of allSourceTypes) {
                for (const entityType of allEntityTypes) {
                    const subscriptionItem = {
                        sourceId: '550e8400-e29b-41d4-a716-446655440001',
                        sourceType,
                        linkedEntityId: '550e8400-e29b-41d4-a716-446655440002',
                        entityType,
                        createdById: '550e8400-e29b-41d4-a716-446655440003',
                        updatedById: '550e8400-e29b-41d4-a716-446655440003'
                    };

                    const result = SubscriptionItemCreateInputSchema.safeParse(subscriptionItem);
                    expect(result.success).toBe(true);

                    if (result.success) {
                        expect(result.data.sourceType).toBe(sourceType);
                        expect(result.data.entityType).toBe(entityType);
                    }
                }
            }
        });

        it('should validate polymorphic validation schema for all combinations', () => {
            for (const sourceType of allSourceTypes) {
                for (const entityType of allEntityTypes) {
                    const polymorphicData = {
                        sourceId: '550e8400-e29b-41d4-a716-446655440001',
                        sourceType,
                        linkedEntityId: '550e8400-e29b-41d4-a716-446655440002',
                        entityType
                    };

                    const result =
                        SubscriptionItemPolymorphicValidationSchema.safeParse(polymorphicData);
                    expect(result.success).toBe(true);
                }
            }
        });
    });

    describe('Polymorphic Query Validations', () => {
        it('should handle single source filtering', () => {
            const query = {
                sourceId: '550e8400-e29b-41d4-a716-446655440001',
                sourceType: SubscriptionItemSourceTypeEnum.SUBSCRIPTION
            };

            const result = SubscriptionItemQuerySchema.safeParse(query);
            expect(result.success).toBe(true);
        });

        it('should handle multiple source types filtering', () => {
            const query = {
                sourceTypes: [
                    SubscriptionItemSourceTypeEnum.SUBSCRIPTION,
                    SubscriptionItemSourceTypeEnum.PURCHASE
                ],
                entityTypes: [
                    SubscriptionItemEntityTypeEnum.SPONSORSHIP,
                    SubscriptionItemEntityTypeEnum.CAMPAIGN
                ]
            };

            const result = SubscriptionItemQuerySchema.safeParse(query);
            expect(result.success).toBe(true);
        });

        it('should handle polymorphic pairs filtering', () => {
            const query = {
                polymorphicPairs: [
                    {
                        sourceType: SubscriptionItemSourceTypeEnum.SUBSCRIPTION,
                        entityType: SubscriptionItemEntityTypeEnum.SPONSORSHIP
                    },
                    {
                        sourceType: SubscriptionItemSourceTypeEnum.PURCHASE,
                        entityType: SubscriptionItemEntityTypeEnum.CAMPAIGN
                    }
                ]
            };

            const result = SubscriptionItemQuerySchema.safeParse(query);
            expect(result.success).toBe(true);
        });
    });

    describe('Source-specific Queries', () => {
        it('should validate by-source queries', () => {
            const query = {
                sourceId: '550e8400-e29b-41d4-a716-446655440001',
                sourceType: SubscriptionItemSourceTypeEnum.SUBSCRIPTION,
                entityTypes: [
                    SubscriptionItemEntityTypeEnum.SPONSORSHIP,
                    SubscriptionItemEntityTypeEnum.CAMPAIGN
                ]
            };

            const result = SubscriptionItemBySourceQuerySchema.safeParse(query);
            expect(result.success).toBe(true);
        });

        it('should require sourceId for by-source queries', () => {
            const invalidQuery = {
                sourceType: SubscriptionItemSourceTypeEnum.SUBSCRIPTION
            };

            const result = SubscriptionItemBySourceQuerySchema.safeParse(invalidQuery);
            expect(result.success).toBe(false);
        });
    });

    describe('Entity-specific Queries', () => {
        it('should validate by-entity queries', () => {
            const query = {
                linkedEntityId: '550e8400-e29b-41d4-a716-446655440002',
                entityType: SubscriptionItemEntityTypeEnum.SPONSORSHIP,
                sourceTypes: [SubscriptionItemSourceTypeEnum.SUBSCRIPTION]
            };

            const result = SubscriptionItemByEntityQuerySchema.safeParse(query);
            expect(result.success).toBe(true);
        });

        it('should require linkedEntityId for by-entity queries', () => {
            const invalidQuery = {
                entityType: SubscriptionItemEntityTypeEnum.SPONSORSHIP
            };

            const result = SubscriptionItemByEntityQuerySchema.safeParse(invalidQuery);
            expect(result.success).toBe(false);
        });
    });

    describe('Edge Cases and Validation', () => {
        it('should reject invalid UUID formats', () => {
            const invalidUuid = {
                sourceId: 'invalid-uuid',
                sourceType: SubscriptionItemSourceTypeEnum.SUBSCRIPTION,
                linkedEntityId: '550e8400-e29b-41d4-a716-446655440002',
                entityType: SubscriptionItemEntityTypeEnum.SPONSORSHIP,
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003'
            };

            const result = SubscriptionItemCreateInputSchema.safeParse(invalidUuid);
            expect(result.success).toBe(false);
        });

        it('should reject empty or missing polymorphic fields', () => {
            const missingFields = {
                sourceId: '550e8400-e29b-41d4-a716-446655440001',
                // sourceType missing
                linkedEntityId: '550e8400-e29b-41d4-a716-446655440002',
                // entityType missing
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003'
            };

            const result = SubscriptionItemCreateInputSchema.safeParse(missingFields);
            expect(result.success).toBe(false);
        });

        it('should handle complex polymorphic queries with defaults', () => {
            const complexQuery = {
                sourceTypes: [SubscriptionItemSourceTypeEnum.SUBSCRIPTION],
                entityTypes: [
                    SubscriptionItemEntityTypeEnum.SPONSORSHIP,
                    SubscriptionItemEntityTypeEnum.CAMPAIGN,
                    SubscriptionItemEntityTypeEnum.FEATURED_ACCOMMODATION
                ],
                page: 1,
                pageSize: 50
            };

            const result = SubscriptionItemQuerySchema.safeParse(complexQuery);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.sortBy).toBe('createdAt'); // default
                expect(result.data.sortOrder).toBe('desc'); // default
                expect(result.data.includeDeleted).toBe(false); // default
            }
        });
    });

    describe('Business Logic Validations', () => {
        it('should create subscription items for subscription sources', () => {
            const subscriptionItem = {
                sourceId: '550e8400-e29b-41d4-a716-446655440001', // subscription ID
                sourceType: SubscriptionItemSourceTypeEnum.SUBSCRIPTION,
                linkedEntityId: '550e8400-e29b-41d4-a716-446655440002', // sponsorship ID
                entityType: SubscriptionItemEntityTypeEnum.SPONSORSHIP,
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003'
            };

            const result = SubscriptionItemCreateInputSchema.safeParse(subscriptionItem);
            expect(result.success).toBe(true);
        });

        it('should create subscription items for purchase sources', () => {
            const subscriptionItem = {
                sourceId: '550e8400-e29b-41d4-a716-446655440001', // purchase ID
                sourceType: SubscriptionItemSourceTypeEnum.PURCHASE,
                linkedEntityId: '550e8400-e29b-41d4-a716-446655440002', // campaign ID
                entityType: SubscriptionItemEntityTypeEnum.CAMPAIGN,
                createdById: '550e8400-e29b-41d4-a716-446655440003',
                updatedById: '550e8400-e29b-41d4-a716-446655440003'
            };

            const result = SubscriptionItemCreateInputSchema.safeParse(subscriptionItem);
            expect(result.success).toBe(true);
        });

        it('should support all listing types with both source types', () => {
            const listingTypes = [
                SubscriptionItemEntityTypeEnum.ACCOMMODATION_LISTING,
                SubscriptionItemEntityTypeEnum.BENEFIT_LISTING,
                SubscriptionItemEntityTypeEnum.SERVICE_LISTING
            ];

            for (const listingType of listingTypes) {
                for (const sourceType of Object.values(SubscriptionItemSourceTypeEnum)) {
                    const subscriptionItem = {
                        sourceId: '550e8400-e29b-41d4-a716-446655440001',
                        sourceType,
                        linkedEntityId: '550e8400-e29b-41d4-a716-446655440002',
                        entityType: listingType,
                        createdById: '550e8400-e29b-41d4-a716-446655440003',
                        updatedById: '550e8400-e29b-41d4-a716-446655440003'
                    };

                    const result = SubscriptionItemCreateInputSchema.safeParse(subscriptionItem);
                    expect(result.success).toBe(true);
                }
            }
        });
    });

    describe('Performance and Scale Tests', () => {
        it('should handle bulk creation validation', () => {
            const items = [];

            // Create 10 different subscription items with various combinations
            for (let i = 0; i < 10; i++) {
                const sourceTypes = Object.values(SubscriptionItemSourceTypeEnum);
                const entityTypes = Object.values(SubscriptionItemEntityTypeEnum);

                items.push({
                    sourceId: `550e8400-e29b-41d4-a716-44665544000${i}`,
                    sourceType: sourceTypes[i % sourceTypes.length],
                    linkedEntityId: `550e8400-e29b-41d4-a716-44665544010${i}`,
                    entityType: entityTypes[i % entityTypes.length],
                    createdById: '550e8400-e29b-41d4-a716-446655440003',
                    updatedById: '550e8400-e29b-41d4-a716-446655440003'
                });
            }

            // Validate each item individually
            for (const item of items) {
                const result = SubscriptionItemCreateInputSchema.safeParse(item);
                expect(result.success).toBe(true);
            }
        });
    });
});

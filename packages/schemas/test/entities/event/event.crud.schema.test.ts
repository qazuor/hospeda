import { describe, expect, it } from 'vitest';
import {
    EventCreateInputSchema,
    EventUpdateInputSchema
} from '../../../src/entities/event/event.crud.schema.js';
import { EventSearchInputSchema } from '../../../src/entities/event/event.query.schema.js';
import { EventCategoryEnum } from '../../../src/enums/index.js';

describe('Event CRUD Schemas', () => {
    describe('EventCreateInputSchema', () => {
        it('should validate correct input', () => {
            const validInput = {
                name: 'Test Event',
                slug: 'test-event',
                summary: 'A test event for validation',
                description:
                    'This is a detailed description of the test event that has more than fifty characters to meet the minimum requirement',
                category: EventCategoryEnum.MUSIC,
                date: {
                    start: new Date('2024-12-25T10:00:00Z'),
                    end: new Date('2024-12-25T18:00:00Z'),
                    isAllDay: false
                },
                locationId: '123e4567-e89b-12d3-a456-426614174002',
                pricing: {
                    price: 50.0,
                    currency: 'USD',
                    isFree: false
                },
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                authorId: '123e4567-e89b-12d3-a456-426614174000',
                organizerId: '123e4567-e89b-12d3-a456-426614174001'
            };

            const result = EventCreateInputSchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should validate minimal required input', () => {
            const minimalInput = {
                name: 'Minimal Event',
                slug: 'minimal-event',
                summary: 'A minimal test event for validation purposes',
                category: EventCategoryEnum.OTHER,
                date: {
                    start: new Date('2024-12-25T10:00:00Z')
                },
                authorId: '123e4567-e89b-12d3-a456-426614174000',
                organizerId: '123e4567-e89b-12d3-a456-426614174001',
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE'
            };

            const result = EventCreateInputSchema.safeParse(minimalInput);
            expect(result.success).toBe(true);
        });

        it('should require name field', () => {
            const inputWithoutName = {
                category: EventCategoryEnum.MUSIC,
                date: {
                    start: new Date('2024-12-25T10:00:00Z')
                }
            };

            const result = EventCreateInputSchema.safeParse(inputWithoutName);
            expect(result.success).toBe(false);
        });

        it('should require category field', () => {
            const inputWithoutCategory = {
                name: 'Test Event',
                date: {
                    start: new Date('2024-12-25T10:00:00Z')
                }
            };

            const result = EventCreateInputSchema.safeParse(inputWithoutCategory);
            expect(result.success).toBe(false);
        });

        it('should require date field', () => {
            const inputWithoutDate = {
                name: 'Test Event',
                category: EventCategoryEnum.MUSIC
            };

            const result = EventCreateInputSchema.safeParse(inputWithoutDate);
            expect(result.success).toBe(false);
        });

        it('should require date.start field', () => {
            const inputWithoutDateStart = {
                name: 'Test Event',
                category: EventCategoryEnum.MUSIC,
                date: {
                    end: '2024-12-25T18:00:00Z'
                }
            };

            const result = EventCreateInputSchema.safeParse(inputWithoutDateStart);
            expect(result.success).toBe(false);
        });

        it('should validate all event categories', () => {
            const validCategories = [
                EventCategoryEnum.MUSIC,
                EventCategoryEnum.CULTURE,
                EventCategoryEnum.SPORTS,
                EventCategoryEnum.GASTRONOMY,
                EventCategoryEnum.FESTIVAL,
                EventCategoryEnum.NATURE,
                EventCategoryEnum.THEATER,
                EventCategoryEnum.WORKSHOP,
                EventCategoryEnum.OTHER
            ];

            for (const category of validCategories) {
                const input = {
                    name: 'Test Event',
                    slug: 'test-event',
                    summary: 'A test event for category validation',
                    category,
                    date: {
                        start: new Date('2024-12-25T10:00:00Z')
                    },
                    authorId: '123e4567-e89b-12d3-a456-426614174000',
                    organizerId: '123e4567-e89b-12d3-a456-426614174001',
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE'
                };

                const result = EventCreateInputSchema.safeParse(input);
                expect(result.success).toBe(true);
            }
        });

        it('should reject invalid category', () => {
            const inputWithInvalidCategory = {
                name: 'Test Event',
                category: 'INVALID_CATEGORY',
                date: {
                    start: new Date('2024-12-25T10:00:00Z')
                }
            };

            const result = EventCreateInputSchema.safeParse(inputWithInvalidCategory);
            expect(result.success).toBe(false);
        });

        it('should validate pricing structure', () => {
            const inputWithPricing = {
                name: 'Paid Event',
                slug: 'paid-event',
                summary: 'A paid event for pricing validation',
                category: EventCategoryEnum.MUSIC,
                date: {
                    start: new Date('2024-12-25T10:00:00Z')
                },
                pricing: {
                    price: 25.99,
                    currency: 'USD',
                    isFree: false
                },
                authorId: '123e4567-e89b-12d3-a456-426614174000',
                organizerId: '123e4567-e89b-12d3-a456-426614174001',
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE'
            };

            const result = EventCreateInputSchema.safeParse(inputWithPricing);
            expect(result.success).toBe(true);
        });

        it('should validate free pricing', () => {
            const inputWithFreePricing = {
                name: 'Free Event',
                slug: 'free-event',
                summary: 'A free event for pricing validation',
                category: EventCategoryEnum.CULTURE,
                date: {
                    start: new Date('2024-12-25T10:00:00Z')
                },
                pricing: {
                    isFree: true
                },
                authorId: '123e4567-e89b-12d3-a456-426614174000',
                organizerId: '123e4567-e89b-12d3-a456-426614174001',
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE'
            };

            const result = EventCreateInputSchema.safeParse(inputWithFreePricing);
            expect(result.success).toBe(true);
        });

        it('should validate location structure', () => {
            const inputWithLocation = {
                name: 'Located Event',
                slug: 'located-event',
                summary: 'An event with location for validation',
                category: EventCategoryEnum.SPORTS,
                date: {
                    start: new Date('2024-12-25T10:00:00Z')
                },
                locationId: '123e4567-e89b-12d3-a456-426614174002',
                authorId: '123e4567-e89b-12d3-a456-426614174000',
                organizerId: '123e4567-e89b-12d3-a456-426614174001',
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE'
            };

            const result = EventCreateInputSchema.safeParse(inputWithLocation);
            expect(result.success).toBe(true);
        });

        it('should validate media structure', () => {
            const inputWithMedia = {
                name: 'Event with Media',
                slug: 'event-with-media',
                summary: 'An event with media for validation',
                category: EventCategoryEnum.FESTIVAL,
                date: {
                    start: new Date('2024-12-25T10:00:00Z')
                },
                media: {
                    featuredImage: {
                        url: 'https://example.com/image1.jpg',
                        caption: 'Event featured image',
                        moderationState: 'APPROVED'
                    },
                    gallery: [
                        {
                            url: 'https://example.com/gallery1.jpg',
                            caption: 'Gallery image 1',
                            moderationState: 'APPROVED'
                        }
                    ],
                    videos: [
                        {
                            url: 'https://example.com/video1.mp4',
                            caption: 'Event trailer',
                            moderationState: 'APPROVED'
                        }
                    ]
                },
                authorId: '123e4567-e89b-12d3-a456-426614174000',
                organizerId: '123e4567-e89b-12d3-a456-426614174001',
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE'
            };

            const result = EventCreateInputSchema.safeParse(inputWithMedia);
            expect(result.success).toBe(true);
        });

        it('should not allow audit fields', () => {
            const dataWithAuditFields = {
                name: 'Test Event',
                category: EventCategoryEnum.MUSIC,
                date: {
                    start: new Date('2024-12-25T10:00:00Z')
                },
                // Audit fields that should not be allowed
                id: '550e8400-e29b-41d4-a716-446655440000',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: 'user123',
                updatedBy: 'user456'
            };

            const result = EventCreateInputSchema.safeParse(dataWithAuditFields);
            expect(result.success).toBe(false);
        });
    });

    describe('EventUpdateInputSchema', () => {
        it('should validate partial update input', () => {
            const partialInput = {
                name: 'Updated Event Name'
            };

            const result = EventUpdateInputSchema.safeParse(partialInput);
            expect(result.success).toBe(true);
        });

        it('should validate full update input', () => {
            const fullInput = {
                name: 'Updated Event',
                slug: 'updated-event',
                summary: 'Updated summary',
                description:
                    'Updated description that has more than fifty characters to meet the minimum requirement for event descriptions',
                category: EventCategoryEnum.CULTURE,
                date: {
                    start: new Date('2024-12-26T11:00:00Z'),
                    end: new Date('2024-12-26T19:00:00Z'),
                    isAllDay: false
                },
                pricing: {
                    price: 75.0,
                    currency: 'USD',
                    isFree: false
                },
                visibility: 'PRIVATE',
                lifecycleState: 'DRAFT'
            };

            const result = EventUpdateInputSchema.safeParse(fullInput);
            expect(result.success).toBe(true);
        });

        it('should allow empty object', () => {
            const emptyInput = {};

            const result = EventUpdateInputSchema.safeParse(emptyInput);
            expect(result.success).toBe(true);
        });

        it('should validate category update', () => {
            const categoryUpdate = {
                category: EventCategoryEnum.GASTRONOMY
            };

            const result = EventUpdateInputSchema.safeParse(categoryUpdate);
            expect(result.success).toBe(true);
        });

        it('should reject invalid category in update', () => {
            const invalidCategoryUpdate = {
                category: 'INVALID_CATEGORY'
            };

            const result = EventUpdateInputSchema.safeParse(invalidCategoryUpdate);
            expect(result.success).toBe(false);
        });

        it('should validate date update', () => {
            const dateUpdate = {
                date: {
                    start: new Date('2024-12-27T12:00:00Z'),
                    isAllDay: true
                }
            };

            const result = EventUpdateInputSchema.safeParse(dateUpdate);
            expect(result.success).toBe(true);
        });

        it('should validate pricing update', () => {
            const pricingUpdate = {
                pricing: {
                    isFree: true
                }
            };

            const result = EventUpdateInputSchema.safeParse(pricingUpdate);
            expect(result.success).toBe(true);
        });

        it('should not allow audit fields in update', () => {
            const updateWithAuditFields = {
                name: 'Updated Event',
                // Audit fields that should not be allowed
                id: '550e8400-e29b-41d4-a716-446655440000',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: 'user123',
                updatedBy: 'user456'
            };

            const result = EventUpdateInputSchema.safeParse(updateWithAuditFields);
            expect(result.success).toBe(false);
        });
    });

    describe('EventSearchInputSchema', () => {
        it('should validate empty search input', () => {
            const emptyInput = {};

            const result = EventSearchInputSchema.safeParse(emptyInput);
            expect(result.success).toBe(true);
        });

        it('should validate search with pagination', () => {
            const searchWithPagination = {
                page: 2,
                pageSize: 25
            };

            const result = EventSearchInputSchema.safeParse(searchWithPagination);
            expect(result.success).toBe(true);
        });

        it('should validate search with filters', () => {
            const searchWithFilters = {
                name: 'music',
                category: EventCategoryEnum.MUSIC,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                isFeatured: true
            };

            const result = EventSearchInputSchema.safeParse(searchWithFilters);
            expect(result.success).toBe(true);
        });

        it('should validate search with date range', () => {
            const searchWithDateRange = {
                dateFrom: '2024-01-01T00:00:00Z',
                dateTo: '2024-12-31T23:59:59Z'
            };

            const result = EventSearchInputSchema.safeParse(searchWithDateRange);
            expect(result.success).toBe(true);
        });

        it('should validate search with location filters', () => {
            const searchWithLocation = {
                filters: {
                    organizerId: 'invalid-uuid' // This should fail UUID validation
                }
            };

            const result = EventSearchInputSchema.safeParse(searchWithLocation);
            expect(result.success).toBe(false); // organizerId should be validated as UUID
        });

        it('should validate search with valid UUID organizerId', () => {
            const searchWithValidOrganizerId = {
                filters: {
                    organizerId: '550e8400-e29b-41d4-a716-446655440000'
                }
            };

            const result = EventSearchInputSchema.safeParse(searchWithValidOrganizerId);
            expect(result.success).toBe(true);
        });

        it('should validate search with pricing filters', () => {
            const searchWithPricing = {
                pricingType: 'PAID',
                minPrice: 10.0,
                maxPrice: 100.0
            };

            const result = EventSearchInputSchema.safeParse(searchWithPricing);
            expect(result.success).toBe(true);
        });

        it('should validate search with capacity filters', () => {
            const searchWithCapacity = {
                minCapacity: 50,
                maxCapacity: 500
            };

            const result = EventSearchInputSchema.safeParse(searchWithCapacity);
            expect(result.success).toBe(true);
        });

        it('should validate search with organizer filter', () => {
            const searchWithOrganizer = {
                organizerId: '550e8400-e29b-41d4-a716-446655440000'
            };

            const result = EventSearchInputSchema.safeParse(searchWithOrganizer);
            expect(result.success).toBe(true);
        });

        it('should reject invalid pagination values', () => {
            const invalidPagination = {
                page: 0,
                pageSize: -1
            };

            const result = EventSearchInputSchema.safeParse(invalidPagination);
            expect(result.success).toBe(false);
        });

        it('should reject invalid category in search', () => {
            const invalidCategorySearch = {
                filters: {
                    category: 'INVALID_CATEGORY'
                }
            };

            const result = EventSearchInputSchema.safeParse(invalidCategorySearch);
            expect(result.success).toBe(false);
        });

        it('should reject invalid UUID formats', () => {
            const invalidUuidSearch = {
                filters: {
                    organizerId: 'not-a-uuid'
                }
            };

            const result = EventSearchInputSchema.safeParse(invalidUuidSearch);
            expect(result.success).toBe(false);
        });

        it('should validate complex search query', () => {
            const complexSearch = {
                name: 'concert',
                category: EventCategoryEnum.MUSIC,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                isFeatured: true,
                dateFrom: '2024-06-01T00:00:00Z',
                dateTo: '2024-08-31T23:59:59Z',
                city: 'Los Angeles',
                pricingType: 'PAID',
                minPrice: 25.0,
                maxPrice: 150.0,
                minCapacity: 100,
                maxCapacity: 1000,
                page: 1,
                pageSize: 20
            };

            const result = EventSearchInputSchema.safeParse(complexSearch);
            expect(result.success).toBe(true);
        });
    });

    describe('Schema Relationships and Consistency', () => {
        it('should maintain consistent field types across CRUD schemas', () => {
            const baseEventData = {
                name: 'Consistency Test Event',
                slug: 'consistency-test-event',
                summary: 'A test event for consistency validation purposes',
                category: EventCategoryEnum.THEATER,
                date: {
                    start: new Date('2024-12-25T10:00:00Z')
                },
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE',
                authorId: '123e4567-e89b-12d3-a456-426614174000',
                organizerId: '123e4567-e89b-12d3-a456-426614174001'
            };

            // Test create
            const createResult = EventCreateInputSchema.safeParse(baseEventData);
            expect(createResult.success).toBe(true);

            // Test update (partial)
            const updateData = {
                name: baseEventData.name,
                category: baseEventData.category
            };
            const updateResult = EventUpdateInputSchema.safeParse(updateData);
            expect(updateResult.success).toBe(true);

            // Test search
            const searchData = {
                name: baseEventData.name,
                category: baseEventData.category,
                visibility: baseEventData.visibility
            };
            const searchResult = EventSearchInputSchema.safeParse(searchData);
            expect(searchResult.success).toBe(true);
        });

        it('should handle all enum values consistently', () => {
            const categories = [
                EventCategoryEnum.MUSIC,
                EventCategoryEnum.CULTURE,
                EventCategoryEnum.SPORTS,
                EventCategoryEnum.GASTRONOMY,
                EventCategoryEnum.FESTIVAL,
                EventCategoryEnum.NATURE,
                EventCategoryEnum.THEATER,
                EventCategoryEnum.WORKSHOP,
                EventCategoryEnum.OTHER
            ];

            for (const category of categories) {
                // Test in create
                const createData = {
                    name: 'Test Event',
                    slug: 'test-event',
                    summary: 'A test event for enum consistency validation',
                    category,
                    date: { start: new Date('2024-12-25T10:00:00Z') },
                    authorId: '123e4567-e89b-12d3-a456-426614174000',
                    organizerId: '123e4567-e89b-12d3-a456-426614174001',
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE'
                };
                expect(EventCreateInputSchema.safeParse(createData).success).toBe(true);

                // Test in update
                const updateData = { category };
                expect(EventUpdateInputSchema.safeParse(updateData).success).toBe(true);

                // Test in search
                const searchData = { category };
                expect(EventSearchInputSchema.safeParse(searchData).success).toBe(true);
            }
        });
    });
});

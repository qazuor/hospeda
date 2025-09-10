import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { EventSchema } from '../../../src/entities/event/event.schema.js';
import {
    createEventEdgeCases,
    createInvalidEvent,
    createMinimalEvent,
    createValidEvent
} from '../../fixtures/event.fixtures.js';

describe('EventSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid event', () => {
            const validData = createValidEvent();

            expect(() => EventSchema.parse(validData)).not.toThrow();

            const result = EventSchema.parse(validData);
            expect(result.id).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.category).toBeDefined();
            expect(result.date).toBeDefined();
            expect(result.pricing).toBeDefined();
            expect(result.organizerId).toBeDefined();
        });

        it('should validate minimal required event data', () => {
            const minimalData = createMinimalEvent();

            expect(() => EventSchema.parse(minimalData)).not.toThrow();

            const result = EventSchema.parse(minimalData);
            expect(result.name).toBeDefined();
            expect(result.summary).toBeDefined();
            expect(result.description).toBeDefined();
            expect(result.category).toBeDefined();
            expect(result.date).toBeDefined();
            expect(result.pricing).toBeDefined();
            expect(result.organizerId).toBeDefined();
        });

        it('should validate event with edge case values', () => {
            const edgeCaseData = createEventEdgeCases();

            expect(() => EventSchema.parse(edgeCaseData)).not.toThrow();
        });
    });

    describe('Invalid Data', () => {
        it('should reject event with invalid data', () => {
            const invalidData = createInvalidEvent();

            expect(() => EventSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject event with missing required fields', () => {
            const incompleteData = {
                title: 'Event Title'
                // Missing required fields
            };

            expect(() => EventSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject event with invalid enum values', () => {
            const validData = createValidEvent();
            const invalidCategories = ['INVALID', 'WRONG', '', null, undefined];

            for (const category of invalidCategories) {
                const data = { ...validData, category };
                expect(() => EventSchema.parse(data)).toThrow(ZodError);
            }
        });
    });

    describe('Field Validations', () => {
        describe('name field', () => {
            it('should accept valid names', () => {
                const validData = createValidEvent();
                const testCases = [
                    'Short Event',
                    'A'.repeat(100), // Long title
                    'Event with números 123',
                    'Event with símbolos @#$',
                    'Multi-word Event Title with Spaces'
                ];

                for (const name of testCases) {
                    const data = { ...validData, name };
                    expect(() => EventSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid names', () => {
                const validData = createValidEvent();
                const testCases = [
                    '', // Empty
                    'A', // Too short
                    'AB', // Still too short (minimum 3)
                    'A'.repeat(201) // Too long
                ];

                for (const name of testCases) {
                    const data = { ...validData, name };
                    expect(() => EventSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('category field', () => {
            it('should accept all valid event categories', () => {
                const validData = createValidEvent();
                const validCategories = [
                    'MUSIC',
                    'CULTURE',
                    'SPORTS',
                    'GASTRONOMY',
                    'FESTIVAL',
                    'NATURE',
                    'THEATER',
                    'WORKSHOP',
                    'OTHER'
                ];

                for (const category of validCategories) {
                    const data = { ...validData, category };
                    expect(() => EventSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid event categories', () => {
                const validData = createValidEvent();
                const invalidCategories = ['CONCERT', 'PARTY', 'MEETING', 'invalid', '', null];

                for (const category of invalidCategories) {
                    const data = { ...validData, category };
                    expect(() => EventSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('date field', () => {
            it('should accept valid dates array', () => {
                const validData = createValidEvent();
                const validDates = [
                    [
                        {
                            startDate: new Date('2024-12-25'),
                            endDate: new Date('2024-12-26'),
                            timezone: 'UTC',
                            isAllDay: false
                        }
                    ],
                    [
                        {
                            startDate: new Date('2024-06-01'),
                            endDate: new Date('2024-06-01'),
                            timezone: 'America/New_York',
                            isAllDay: true
                        },
                        {
                            startDate: new Date('2024-06-02'),
                            endDate: new Date('2024-06-02'),
                            timezone: 'America/New_York',
                            isAllDay: true,
                            recurrence: 'WEEKLY'
                        }
                    ]
                ];

                for (const dates of validDates) {
                    const data = { ...validData, dates };
                    expect(() => EventSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid dates', () => {
                const validData = createValidEvent();
                const invalidDates = [
                    [], // Empty array
                    [
                        {
                            startDate: 'invalid-date',
                            endDate: new Date(),
                            timezone: 'UTC',
                            isAllDay: false
                        }
                    ]
                ];

                for (const date of invalidDates) {
                    const data = { ...validData, date };
                    expect(() => EventSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('price field', () => {
            it('should accept valid pricing data', () => {
                const validData = createValidEvent();
                const validPricing = [
                    {
                        price: 0.01,
                        currency: 'USD',
                        isFree: true
                    },
                    {
                        price: 100.5,
                        currency: 'ARS',
                        isFree: false,
                        priceFrom: 50,
                        priceTo: 200
                    }
                ];

                for (const pricing of validPricing) {
                    const data = { ...validData, pricing };
                    expect(() => EventSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid pricing data', () => {
                const validData = createValidEvent();
                const invalidPricing = [
                    {
                        price: 'not-number',
                        currency: 'USD',
                        isFree: true
                    },
                    {
                        price: -100, // Negative price
                        currency: 'USD',
                        isFree: false
                    }
                ];

                for (const pricing of invalidPricing) {
                    const data = { ...validData, pricing };
                    expect(() => EventSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('organizerId field', () => {
            it('should accept valid organizer data', () => {
                const validData = createValidEvent();
                const validOrganizerIds = [
                    '123e4567-e89b-12d3-a456-426614174000',
                    '123e4567-e89b-12d3-a456-426614174001',
                    undefined // Optional field
                ];

                for (const organizerId of validOrganizerIds) {
                    const data = { ...validData, organizerId };
                    expect(() => EventSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid organizer data', () => {
                const validData = createValidEvent();
                const invalidOrganizers = [
                    'invalid-uuid', // Invalid UUID format
                    'not-a-uuid-at-all',
                    123 // Wrong type
                ];

                for (const organizerId of invalidOrganizers) {
                    const data = { ...validData, organizerId };
                    expect(() => EventSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('isFeatured field', () => {
            it('should accept valid boolean values', () => {
                const validData = createValidEvent();
                const validBooleans = [true, false];

                for (const isFeatured of validBooleans) {
                    const data = { ...validData, isFeatured };
                    expect(() => EventSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid boolean values', () => {
                const validData = createValidEvent();
                const invalidBooleans = ['not-boolean', {}, [], 'maybe'];

                for (const isFeatured of invalidBooleans) {
                    const data = { ...validData, isFeatured };
                    expect(() => EventSchema.parse(data)).toThrow(ZodError);
                }
            });
        });
    });

    describe('Optional Fields', () => {
        it('should handle optional fields correctly', () => {
            const baseData = createMinimalEvent();

            // Should work without optional fields
            expect(() => EventSchema.parse(baseData)).not.toThrow();

            // Should work with some optional fields
            const withOptionals = {
                ...baseData,
                seo: {
                    title: 'Event SEO title thirty chars min',
                    description:
                        'This is an event SEO description that has at least seventy characters to meet the minimum requirement.',
                    keywords: ['event', 'culture']
                },
                media: {
                    featuredImage: {
                        url: 'https://example.com/event.jpg',
                        alt: 'Amazing event',
                        moderationState: 'APPROVED'
                    }
                },
                tags: [
                    {
                        id: faker.string.uuid(),
                        slug: 'music',
                        name: 'Music',
                        color: 'BLUE',
                        lifecycleState: 'ACTIVE',
                        createdAt: faker.date.past(),
                        updatedAt: faker.date.recent(),
                        createdById: faker.string.uuid(),
                        updatedById: faker.string.uuid()
                    },
                    {
                        id: faker.string.uuid(),
                        slug: 'live',
                        name: 'Live',
                        color: 'GREEN',
                        lifecycleState: 'ACTIVE',
                        createdAt: faker.date.past(),
                        updatedAt: faker.date.recent(),
                        createdById: faker.string.uuid(),
                        updatedById: faker.string.uuid()
                    }
                ],
                locationId: faker.string.uuid(),
                organizerId: faker.string.uuid()
            };

            expect(() => EventSchema.parse(withOptionals)).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should handle edge case values', () => {
            const validData = createEventEdgeCases();

            expect(() => EventSchema.parse(validData)).not.toThrow();

            const result = EventSchema.parse(validData);
            expect(result.name).toBeDefined();
            expect(result.isFeatured).toBeDefined();
        });

        it('should handle empty arrays', () => {
            const validData = createValidEvent();
            const dataWithEmptyArrays = {
                ...validData,
                tags: [],
                media: {
                    images: [],
                    videos: []
                }
            };

            expect(() => EventSchema.parse(dataWithEmptyArrays)).not.toThrow();
        });

        it('should handle null vs undefined for optional fields', () => {
            const validData = createValidEvent();

            // undefined should work for optional fields
            const withUndefined = {
                ...validData,
                seo: undefined,
                tags: undefined,
                onlineUrl: undefined,
                ageRestriction: undefined,
                registrationUrl: undefined,
                destinationId: undefined,
                accommodationId: undefined
            };
            expect(() => EventSchema.parse(withUndefined)).not.toThrow();
        });

        it('should handle boolean flags correctly', () => {
            const validData = createValidEvent();
            const booleanTests = [{ isFeatured: true }, { isFeatured: false }];

            for (const flags of booleanTests) {
                const data = { ...validData, ...flags };
                expect(() => EventSchema.parse(data)).not.toThrow();
            }
        });
    });

    describe('Type Inference', () => {
        it('should infer correct TypeScript types', () => {
            const validData = createValidEvent();
            const result = EventSchema.parse(validData);

            // TypeScript should infer these correctly
            expect(typeof result.id).toBe('string');
            expect(typeof result.name).toBe('string');
            expect(typeof result.category).toBe('string');
            expect(typeof result.isFeatured).toBe('boolean');
            expect(typeof result.authorId).toBe('string');
            expect(typeof result.date).toBe('object');
            expect(typeof result.pricing).toBe('object');
            if (result.organizerId !== undefined) {
                expect(typeof result.organizerId).toBe('string');
            }

            // Optional fields
            if (result.tags !== undefined) {
                expect(Array.isArray(result.tags)).toBe(true);
            }
            if (result.ageRestriction !== undefined) {
                expect(typeof result.ageRestriction).toBe('number');
            }
        });
    });
});

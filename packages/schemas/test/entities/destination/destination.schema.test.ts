import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { DestinationSchema } from '../../../src/entities/destination/destination.schema.js';
import {
    createBaseAdminFields,
    createBaseAuditFields,
    createBaseLifecycleFields
} from '../../fixtures/common.fixtures.js';
import {
    createDestinationEdgeCases,
    createMinimalDestination,
    createValidDestination
} from '../../fixtures/destination.fixtures.js';

describe('DestinationSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid destination', () => {
            const validData = createValidDestination();

            expect(() => DestinationSchema.parse(validData)).not.toThrow();

            const result = DestinationSchema.parse(validData);
            expect(result.id).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.location).toBeDefined();
            if (result.location) {
                expect(result.location.country).toBeDefined();
                expect(result.location.state).toBeDefined();
            }
        });

        it('should validate minimal required destination data', () => {
            const minimalData = createMinimalDestination();

            expect(() => DestinationSchema.parse(minimalData)).not.toThrow();

            const result = DestinationSchema.parse(minimalData);
            expect(result.name).toBeDefined();
            expect(result.summary).toBeDefined();
            expect(result.description).toBeDefined();
            expect(result.location).toBeDefined();
        });

        it('should validate destination with edge case values', () => {
            const edgeCaseData = createDestinationEdgeCases();

            expect(() => DestinationSchema.parse(edgeCaseData)).not.toThrow();
        });
    });

    describe('Invalid Data', () => {
        it('should reject destination with invalid data', () => {
            const invalidData = {
                ...createValidDestination(),
                location: {
                    // Invalid location structure
                    invalidField: 'invalid'
                }
            };

            expect(() => DestinationSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject destination with missing required fields', () => {
            const incompleteData = {
                name: 'Destination Name'
                // Missing required fields like location, summary, description
            };

            expect(() => DestinationSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject destination with invalid enum values', () => {
            const validData = createValidDestination();
            const invalidVisibilities = ['INVALID', 'WRONG', '', null];

            for (const visibility of invalidVisibilities) {
                const data = { ...validData, visibility };
                expect(() => DestinationSchema.parse(data)).toThrow(ZodError);
            }
        });
    });

    describe('Field Validations', () => {
        describe('name field', () => {
            it('should accept valid names', () => {
                const validData = createValidDestination();
                const testCases = [
                    'Paris',
                    'New York City',
                    'São Paulo',
                    'Buenos Aires',
                    'A'.repeat(100) // Long name
                ];

                for (const name of testCases) {
                    const data = { ...validData, name };
                    expect(() => DestinationSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid names', () => {
                const validData = createValidDestination();
                const testCases = [
                    '', // Empty
                    'A', // Too short
                    'AB', // Still too short (minimum 3)
                    'A'.repeat(201) // Too long
                ];

                for (const name of testCases) {
                    const data = { ...validData, name };
                    expect(() => DestinationSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('location field', () => {
            it('should accept valid location data', () => {
                const validData = createValidDestination();
                const validLocation = {
                    street: '123 Main St',
                    number: '123',
                    city: 'Paris',
                    state: 'Île-de-France',
                    country: 'France',
                    zipCode: '75001',
                    coordinates: {
                        lat: '48.8566',
                        long: '2.3522'
                    }
                };

                const data = { ...validData, location: validLocation };
                expect(() => DestinationSchema.parse(data)).not.toThrow();
            });

            it('should reject invalid location data', () => {
                const validData = createValidDestination();
                const invalidLocations = [
                    {}, // Empty location
                    { city: 'Paris' }, // Missing required fields
                    {
                        city: 'Paris',
                        country: 'France',
                        coordinates: {
                            lat: 'invalid', // Invalid coordinate
                            long: '2.3522'
                        }
                    }
                ];

                for (const location of invalidLocations) {
                    const data = { ...validData, location };
                    expect(() => DestinationSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('attractions field', () => {
            it('should accept valid attractions array', () => {
                const validData = createValidDestination();

                expect(() => DestinationSchema.parse(validData)).not.toThrow();

                const result = DestinationSchema.parse(validData);
                if (result.attractions && result.attractions.length > 0) {
                    expect(result.attractions[0]?.name).toBeDefined();
                    expect(result.attractions[0]?.destinationId).toBeDefined();
                }
            });

            it('should accept empty attractions array', () => {
                const validData = createValidDestination();
                const dataWithEmptyAttractions = {
                    ...validData,
                    attractions: []
                };

                expect(() => DestinationSchema.parse(dataWithEmptyAttractions)).not.toThrow();
            });
        });
    });

    describe('Optional Fields', () => {
        it('should handle optional fields correctly', () => {
            const baseData = createMinimalDestination();

            // Should work without optional fields
            expect(() => DestinationSchema.parse(baseData)).not.toThrow();

            // Should work with some optional fields
            const withOptionals = {
                ...baseData,
                seo: {
                    title: 'Destination SEO title thirty chars',
                    description:
                        'This is a destination SEO description that has at least seventy characters to meet the minimum requirement.',
                    keywords: ['destination', 'travel']
                },
                media: {
                    featuredImage: {
                        url: 'https://example.com/destination.jpg',
                        alt: 'Beautiful destination',
                        moderationState: 'APPROVED'
                    },
                    images: [
                        {
                            url: 'https://example.com/image1.jpg',
                            alt: 'Image 1',
                            moderationState: 'APPROVED'
                        }
                    ]
                },
                tags: [
                    {
                        id: faker.string.uuid(),
                        name: 'popular',
                        slug: 'popular',
                        color: 'BLUE',
                        ...createBaseAuditFields(),
                        ...createBaseLifecycleFields(),
                        ...createBaseAdminFields()
                    },
                    {
                        id: faker.string.uuid(),
                        name: 'scenic',
                        slug: 'scenic',
                        color: 'GREEN',
                        ...createBaseAuditFields(),
                        ...createBaseLifecycleFields(),
                        ...createBaseAdminFields()
                    }
                ],
                attractions: []
            };

            expect(() => DestinationSchema.parse(withOptionals)).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should handle edge case values', () => {
            const validData = createDestinationEdgeCases();

            expect(() => DestinationSchema.parse(validData)).not.toThrow();

            const result = DestinationSchema.parse(validData);
            expect(result.name).toBeDefined();
            expect(result.location).toBeDefined();
        });

        it('should handle empty arrays', () => {
            const validData = createValidDestination();
            const dataWithEmptyArrays = {
                ...validData,
                tags: [],
                attractions: [],
                media: {
                    images: [],
                    videos: []
                }
            };

            expect(() => DestinationSchema.parse(dataWithEmptyArrays)).not.toThrow();
        });

        it('should handle null vs undefined for optional fields', () => {
            const validData = createValidDestination();

            // undefined should work for optional fields
            const withUndefined = {
                ...validData,
                seo: undefined,
                tags: undefined,
                attractions: undefined,
                media: undefined
            };
            expect(() => DestinationSchema.parse(withUndefined)).not.toThrow();
        });
    });

    describe('Type Inference', () => {
        it('should infer correct TypeScript types', () => {
            const validData = createValidDestination();
            const result = DestinationSchema.parse(validData);

            // TypeScript should infer these correctly
            expect(typeof result.id).toBe('string');
            expect(typeof result.name).toBe('string');
            expect(typeof result.summary).toBe('string');
            expect(typeof result.description).toBe('string');
            expect(typeof result.location).toBe('object');
            if (result.location) {
                expect(typeof result.location.country).toBe('string');
                expect(typeof result.location.state).toBe('string');
            }

            // Optional fields
            if (result.tags !== undefined) {
                expect(Array.isArray(result.tags)).toBe(true);
            }
            if (result.attractions !== undefined) {
                expect(Array.isArray(result.attractions)).toBe(true);
            }
        });
    });
});

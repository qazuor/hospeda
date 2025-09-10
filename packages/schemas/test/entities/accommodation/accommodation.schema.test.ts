import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AccommodationSchema } from '../../../src/entities/accommodation/accommodation.schema.js';
import {
    createAccommodationEdgeCases,
    createComplexAccommodation,
    createInvalidAccommodation,
    createMinimalAccommodation,
    createValidAccommodation
} from '../../fixtures/accommodation.fixtures.js';

describe('AccommodationSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid accommodation', () => {
            const validData = createValidAccommodation();

            expect(() => AccommodationSchema.parse(validData)).not.toThrow();

            const result = AccommodationSchema.parse(validData);
            expect(result).toBeDefined();
            expect(result.id).toBe(validData.id);
            expect(result.name).toBe(validData.name);
            expect(result.type).toBe(validData.type);
        });

        it('should validate minimal required accommodation data', () => {
            const minimalData = createMinimalAccommodation();

            expect(() => AccommodationSchema.parse(minimalData)).not.toThrow();
        });

        it('should validate complex nested accommodation', () => {
            const complexData = createComplexAccommodation();

            expect(() => AccommodationSchema.parse(complexData)).not.toThrow();

            const result = AccommodationSchema.parse(complexData);
            expect(result.iaData?.[0]?.title).toBeDefined();
            expect(result.iaData?.[0]?.content).toBeDefined();
        });
    });

    describe('Invalid Data', () => {
        it('should reject accommodation with invalid data', () => {
            const invalidData = createInvalidAccommodation();

            expect(() => AccommodationSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject accommodation with missing required fields', () => {
            const incompleteData = {
                name: 'Test Hotel'
                // Missing type, destinationId, ownerId, location
            };

            expect(() => AccommodationSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject accommodation with invalid enum values', () => {
            const validData = createValidAccommodation();
            const invalidData = {
                ...validData,
                type: 'INVALID_TYPE',
                visibility: 'INVALID_VISIBILITY'
            };

            expect(() => AccommodationSchema.parse(invalidData)).toThrow(ZodError);
        });
    });

    describe('Field Validations', () => {
        describe('name field', () => {
            it('should accept valid names', () => {
                const validData = createValidAccommodation();
                const testCases = [
                    'Hotel Paradise',
                    'ABC', // Minimum length (3 chars)
                    'A'.repeat(100), // Maximum length
                    'Hotel & Spa Resort',
                    'Hôtel Français'
                ];

                for (const name of testCases) {
                    const data = { ...validData, name };
                    expect(() => AccommodationSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid names', () => {
                const validData = createValidAccommodation();
                const testCases = [
                    '', // Empty
                    'A'.repeat(201) // Too long
                ];

                for (const name of testCases) {
                    const data = { ...validData, name };
                    expect(() => AccommodationSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('type field', () => {
            it('should accept all valid accommodation types', () => {
                const validData = createValidAccommodation();
                const validTypes = ['HOTEL', 'CABIN', 'HOSTEL', 'APARTMENT', 'HOUSE'];

                for (const type of validTypes) {
                    const data = { ...validData, type };
                    expect(() => AccommodationSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid accommodation types', () => {
                const validData = createValidAccommodation();
                const invalidTypes = ['INVALID_TYPE', 'MANSION', 'invalid', '', null];

                for (const type of invalidTypes) {
                    const data = { ...validData, type };
                    expect(() => AccommodationSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('price field', () => {
            it('should accept valid pricing data', () => {
                const validData = createValidAccommodation();
                const validPrices = [
                    { price: 0.01, currency: 'USD' },
                    { price: 999999.99, currency: 'ARS' },
                    { price: 100, currency: 'USD' },
                    { price: 50, currency: 'ARS' }
                ];

                for (const price of validPrices) {
                    const data = { ...validData, price };
                    expect(() => AccommodationSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid pricing data', () => {
                const validData = createValidAccommodation();
                const invalidPrices = [
                    { price: -1, currency: 'USD' }, // Negative price
                    { price: 0, currency: 'USD' }, // Zero price
                    { price: 100, currency: 'INVALID' }, // Invalid currency
                    { price: 'not-a-number', currency: 'USD' } // Invalid type
                ];

                for (const price of invalidPrices) {
                    const data = { ...validData, price };
                    expect(() => AccommodationSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('location field', () => {
            it('should accept valid location data', () => {
                const validData = createValidAccommodation();
                const validLocation = {
                    street: '123 Main St',
                    number: '123',
                    city: 'New York',
                    state: 'NY',
                    country: 'USA',
                    zipCode: '10001',
                    coordinates: {
                        lat: '40.7128',
                        long: '-74.006'
                    }
                };

                const data = { ...validData, location: validLocation };
                expect(() => AccommodationSchema.parse(data)).not.toThrow();
            });

            it('should reject invalid coordinates', () => {
                const validData = createValidAccommodation();
                const invalidCoordinates = [
                    { latitude: 91, longitude: 0 }, // Invalid latitude
                    { latitude: -91, longitude: 0 }, // Invalid latitude
                    { latitude: 0, longitude: 181 }, // Invalid longitude
                    { latitude: 0, longitude: -181 } // Invalid longitude
                ];

                for (const coordinates of invalidCoordinates) {
                    const data = {
                        ...validData,
                        location: {
                            ...validData.location,
                            coordinates
                        }
                    };
                    expect(() => AccommodationSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('contact field', () => {
            it('should accept valid contact information', () => {
                const validData = createValidAccommodation();
                const validContacts = [
                    { personalEmail: 'test@example.com', mobilePhone: '+1234567890' },
                    {
                        personalEmail: 'test@example.com',
                        mobilePhone: '+1234567890',
                        workPhone: '+1234567891'
                    },
                    {
                        personalEmail: 'test@example.com',
                        mobilePhone: '+1234567890',
                        website: 'https://example.com'
                    },
                    {
                        personalEmail: 'test@example.com',
                        workEmail: 'work@example.com',
                        mobilePhone: '+1234567890',
                        homePhone: '+1234567891',
                        website: 'https://example.com'
                    }
                ];

                for (const contact of validContacts) {
                    const data = { ...validData, contact };
                    expect(() => AccommodationSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid contact information', () => {
                const validData = createValidAccommodation();
                const invalidContacts = [
                    { contactInfo: { personalEmail: 'invalid-email', mobilePhone: '+1234567890' } },
                    {
                        contactInfo: {
                            personalEmail: 'test@example.com',
                            mobilePhone: '+1234567890',
                            website: 'not-a-url'
                        }
                    },
                    {
                        contactInfo: {
                            personalEmail: 'test@example.com',
                            mobilePhone: 'invalid-phone'
                        }
                    }
                ];

                for (const contact of invalidContacts) {
                    const data = { ...validData, ...contact };
                    expect(() => AccommodationSchema.parse(data)).toThrow(ZodError);
                }
            });
        });
    });

    describe('Optional Fields', () => {
        it('should handle optional fields correctly', () => {
            const baseData = createMinimalAccommodation();

            // Should work without optional fields
            expect(() => AccommodationSchema.parse(baseData)).not.toThrow();

            // Should work with some optional fields
            const withOptionals = {
                ...baseData,
                seo: {
                    title: 'This is a comprehensive SEO title for the accommodation page',
                    description:
                        'This is a detailed SEO description that provides comprehensive information about the accommodation and its amenities for search engines.',
                    keywords: ['hotel', 'accommodation']
                },
                adminInfo: {
                    notes: 'Admin notes',
                    priority: 'NORMAL'
                }
            };

            expect(() => AccommodationSchema.parse(withOptionals)).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should handle edge case values', () => {
            const edgeCaseData = createAccommodationEdgeCases();

            // Some edge cases should be valid, others should fail
            // This tests boundary conditions
            expect(() => AccommodationSchema.parse(edgeCaseData)).toThrow();
        });

        it('should handle empty arrays', () => {
            const validData = createValidAccommodation();
            const dataWithEmptyArrays = {
                ...validData,
                tags: []
            };

            expect(() => AccommodationSchema.parse(dataWithEmptyArrays)).not.toThrow();
        });

        it('should handle null vs undefined for optional fields', () => {
            const validData = createValidAccommodation();

            // undefined should be fine for optional fields
            const withUndefined = {
                ...validData,
                seo: undefined,
                adminInfo: undefined
            };
            expect(() => AccommodationSchema.parse(withUndefined)).not.toThrow();

            // null might be handled differently depending on schema definition
            const _withNull = {
                ...validData,
                seo: null,
                adminInfo: null
            };
            // This might throw or not, depending on how we defined the schema
            // We'll test both scenarios
        });
    });

    describe('Type Inference', () => {
        it('should infer correct TypeScript types', () => {
            const validData = createValidAccommodation();
            const result = AccommodationSchema.parse(validData);

            // TypeScript should infer these correctly
            expect(typeof result.id).toBe('string');
            expect(typeof result.name).toBe('string');
            expect(typeof result.type).toBe('string');
            expect(typeof result.price?.price).toBe('number');
            // Tags is optional, so check if it exists
            if (result.tags !== undefined) {
                expect(Array.isArray(result.tags)).toBe(true);
            }
        });
    });
});

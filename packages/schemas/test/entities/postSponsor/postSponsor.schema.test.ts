import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PostSponsorSchema } from '../../../src/entities/postSponsor/postSponsor.schema.js';
import {
    createInvalidPostSponsor,
    createMinimalPostSponsor,
    createPostSponsorEdgeCases,
    createPostSponsorMaxValues,
    createPostSponsorTooLong,
    createValidPostSponsor
} from '../../fixtures/postSponsor.fixtures.js';

describe('PostSponsorSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid post sponsor', () => {
            const validData = createValidPostSponsor();

            expect(() => PostSponsorSchema.parse(validData)).not.toThrow();

            const result = PostSponsorSchema.parse(validData);
            expect(result.id).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.type).toBeDefined();
            expect(result.description).toBeDefined();
        });

        it('should validate minimal required post sponsor data', () => {
            const minimalData = createMinimalPostSponsor();

            expect(() => PostSponsorSchema.parse(minimalData)).not.toThrow();

            const result = PostSponsorSchema.parse(minimalData);
            expect(result.name).toBeDefined();
            expect(result.type).toBeDefined();
            expect(result.description).toBeDefined();
        });

        it('should validate post sponsor with edge case values', () => {
            const edgeCaseData = createPostSponsorEdgeCases();

            expect(() => PostSponsorSchema.parse(edgeCaseData)).not.toThrow();
        });

        it('should validate post sponsor with maximum values', () => {
            const maxData = createPostSponsorMaxValues();

            expect(() => PostSponsorSchema.parse(maxData)).not.toThrow();
        });
    });

    describe('Invalid Data', () => {
        it('should reject post sponsor with invalid data', () => {
            const invalidData = createInvalidPostSponsor();

            expect(() => PostSponsorSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject post sponsor with missing required fields', () => {
            const incompleteData = {
                name: 'Sponsor Name'
                // Missing required fields: type, description
            };

            expect(() => PostSponsorSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject post sponsor with values that are too long', () => {
            const tooLongData = createPostSponsorTooLong();

            expect(() => PostSponsorSchema.parse(tooLongData)).toThrow(ZodError);
        });
    });

    describe('Field Validations', () => {
        describe('name field', () => {
            it('should accept valid names', () => {
                const validData = createValidPostSponsor();
                const testCases = [
                    'ABC', // Minimum length
                    'Valid Company Name',
                    'A'.repeat(100), // Maximum length
                    'Company with Numbers 123',
                    'Company & Associates LLC'
                ];

                for (const name of testCases) {
                    const data = { ...validData, name };
                    expect(() => PostSponsorSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid names', () => {
                const validData = createValidPostSponsor();
                const testCases = [
                    '', // Empty
                    'AB', // Too short (min 3)
                    'A'.repeat(101) // Too long (max 100)
                ];

                for (const name of testCases) {
                    const data = { ...validData, name };
                    expect(() => PostSponsorSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('type field', () => {
            it('should accept all valid client types', () => {
                const validData = createValidPostSponsor();
                const validTypes = ['POST_SPONSOR', 'ADVERTISER', 'HOST'];

                for (const type of validTypes) {
                    const data = { ...validData, type };
                    expect(() => PostSponsorSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid client types', () => {
                const validData = createValidPostSponsor();
                const invalidTypes = ['BUSINESS', 'PERSON', 'invalid', '', null];

                for (const type of invalidTypes) {
                    const data = { ...validData, type };
                    expect(() => PostSponsorSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('description field', () => {
            it('should accept valid descriptions', () => {
                const validData = createValidPostSponsor();
                const validDescriptions = [
                    'A'.repeat(10), // Minimum length
                    'Valid description with enough characters to meet requirements.',
                    'A'.repeat(500), // Maximum length
                    'Description with\nmultiple\nlines and special chars: @#$%'
                ];

                for (const description of validDescriptions) {
                    const data = { ...validData, description };
                    expect(() => PostSponsorSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid descriptions', () => {
                const validData = createValidPostSponsor();
                const invalidDescriptions = [
                    '', // Empty
                    'Short', // Too short (min 10)
                    'A'.repeat(501) // Too long (max 500)
                ];

                for (const description of invalidDescriptions) {
                    const data = { ...validData, description };
                    expect(() => PostSponsorSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('logo field', () => {
            it('should accept valid logo objects', () => {
                const validData = createValidPostSponsor();
                const validLogos = [
                    undefined, // Optional field
                    {
                        url: 'https://example.com/logo.jpg'
                    },
                    {
                        url: 'https://example.com/logo.png',
                        caption: 'Company logo',
                        description: 'Official company logo',
                        moderationState: 'APPROVED'
                    }
                ];

                for (const logo of validLogos) {
                    const data = { ...validData, logo };
                    expect(() => PostSponsorSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid logo objects', () => {
                const validData = createValidPostSponsor();
                const invalidLogos = [
                    { url: 'invalid-url' }, // Invalid URL
                    { url: '' }, // Empty URL
                    { caption: 'No URL provided' } // Missing required URL
                ];

                for (const logo of invalidLogos) {
                    const data = { ...validData, logo };
                    expect(() => PostSponsorSchema.parse(data)).toThrow(ZodError);
                }
            });
        });
    });

    describe('Optional Fields', () => {
        it('should handle optional fields correctly', () => {
            const baseData = createMinimalPostSponsor();

            // Should work without optional fields
            expect(() => PostSponsorSchema.parse(baseData)).not.toThrow();

            // Should work with optional contact fields
            const withOptionals = {
                ...baseData,
                contactInfo: {
                    personalEmail: 'sponsor@example.com',
                    mobilePhone: '+1234567890',
                    website: 'https://sponsor.example.com'
                },
                socialNetworks: {
                    facebook: 'https://facebook.com/sponsor',
                    instagram: 'https://instagram.com/sponsor',
                    twitter: 'https://twitter.com/sponsor'
                },
                logo: {
                    url: 'https://example.com/logo.jpg',
                    caption: 'Sponsor logo'
                }
            };

            expect(() => PostSponsorSchema.parse(withOptionals)).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should handle edge case values', () => {
            const validData = createPostSponsorEdgeCases();

            expect(() => PostSponsorSchema.parse(validData)).not.toThrow();

            const result = PostSponsorSchema.parse(validData);
            expect(result.name).toBeDefined();
            expect(result.description).toBeDefined();
        });

        it('should handle null vs undefined for optional fields', () => {
            const validData = createValidPostSponsor();

            // undefined should work for optional fields
            const withUndefined = {
                ...validData,
                logo: undefined,
                contactInfo: undefined,
                socialNetworks: undefined
            };
            expect(() => PostSponsorSchema.parse(withUndefined)).not.toThrow();
        });
    });

    describe('Type Inference', () => {
        it('should infer correct TypeScript types', () => {
            const validData = createValidPostSponsor();
            const result = PostSponsorSchema.parse(validData);

            // TypeScript should infer these correctly
            expect(typeof result.id).toBe('string');
            expect(typeof result.name).toBe('string');
            expect(typeof result.type).toBe('string');
            expect(typeof result.description).toBe('string');

            // Optional fields
            if (result.logo !== undefined) {
                expect(typeof result.logo.url).toBe('string');
            }
            if (result.contactInfo !== undefined) {
                expect(typeof result.contactInfo).toBe('object');
            }
        });
    });
});

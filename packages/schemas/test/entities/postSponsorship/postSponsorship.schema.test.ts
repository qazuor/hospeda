import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PostSponsorshipSchema } from '../../../src/entities/postSponsorship/postSponsorship.schema.js';
import {
    createInvalidPostSponsorship,
    createMinimalPostSponsorship,
    createPostSponsorshipEdgeCases,
    createPostSponsorshipMaxValues,
    createPostSponsorshipTooLong,
    createPostSponsorshipWithDateRange,
    createValidPostSponsorship
} from '../../fixtures/postSponsorship.fixtures.js';

describe('PostSponsorshipSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid post sponsorship', () => {
            const validData = createValidPostSponsorship();

            expect(() => PostSponsorshipSchema.parse(validData)).not.toThrow();

            const result = PostSponsorshipSchema.parse(validData);
            expect(result.id).toBeDefined();
            expect(result.sponsorId).toBeDefined();
            expect(result.postId).toBeDefined();
            expect(result.description).toBeDefined();
            expect(result.paid).toBeDefined();
        });

        it('should validate minimal required post sponsorship data', () => {
            const minimalData = createMinimalPostSponsorship();

            expect(() => PostSponsorshipSchema.parse(minimalData)).not.toThrow();

            const result = PostSponsorshipSchema.parse(minimalData);
            expect(result.sponsorId).toBeDefined();
            expect(result.postId).toBeDefined();
            expect(result.description).toBeDefined();
            expect(result.paid).toBeDefined();
        });

        it('should validate post sponsorship with edge case values', () => {
            const edgeCaseData = createPostSponsorshipEdgeCases();

            expect(() => PostSponsorshipSchema.parse(edgeCaseData)).not.toThrow();
        });

        it('should validate post sponsorship with maximum values', () => {
            const maxData = createPostSponsorshipMaxValues();

            expect(() => PostSponsorshipSchema.parse(maxData)).not.toThrow();
        });

        it('should validate post sponsorship with date range', () => {
            const dateRangeData = createPostSponsorshipWithDateRange();

            expect(() => PostSponsorshipSchema.parse(dateRangeData)).not.toThrow();
        });
    });

    describe('Invalid Data', () => {
        it('should reject post sponsorship with invalid data', () => {
            const invalidData = createInvalidPostSponsorship();

            expect(() => PostSponsorshipSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject post sponsorship with missing required fields', () => {
            const incompleteData = {
                sponsorId: '123e4567-e89b-12d3-a456-426614174000'
                // Missing required fields: postId, description, paid
            };

            expect(() => PostSponsorshipSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject post sponsorship with values that are too long', () => {
            const tooLongData = createPostSponsorshipTooLong();

            expect(() => PostSponsorshipSchema.parse(tooLongData)).toThrow(ZodError);
        });
    });

    describe('Field Validations', () => {
        describe('sponsorId field', () => {
            it('should accept valid UUIDs', () => {
                const validData = createValidPostSponsorship();
                const validUUIDs = [
                    '123e4567-e89b-12d3-a456-426614174000',
                    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
                ];

                for (const sponsorId of validUUIDs) {
                    const data = { ...validData, sponsorId };
                    expect(() => PostSponsorshipSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid UUIDs', () => {
                const validData = createValidPostSponsorship();
                const invalidUUIDs = ['invalid-uuid', '123', '', 'not-a-uuid-at-all'];

                for (const sponsorId of invalidUUIDs) {
                    const data = { ...validData, sponsorId };
                    expect(() => PostSponsorshipSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('postId field', () => {
            it('should accept valid UUIDs', () => {
                const validData = createValidPostSponsorship();
                const validUUIDs = [
                    '123e4567-e89b-12d3-a456-426614174000',
                    'f47ac10b-58cc-4372-a567-0e02b2c3d479'
                ];

                for (const postId of validUUIDs) {
                    const data = { ...validData, postId };
                    expect(() => PostSponsorshipSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid UUIDs', () => {
                const validData = createValidPostSponsorship();
                const invalidUUIDs = ['invalid-uuid', '', '123'];

                for (const postId of invalidUUIDs) {
                    const data = { ...validData, postId };
                    expect(() => PostSponsorshipSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('message field', () => {
            it('should accept valid messages', () => {
                const validData = createValidPostSponsorship();
                const validMessages = [
                    undefined, // Optional field
                    'Hello', // Minimum length (5 chars)
                    'Valid sponsorship message',
                    'A'.repeat(300) // Maximum length
                ];

                for (const message of validMessages) {
                    const data = { ...validData, message };
                    expect(() => PostSponsorshipSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid messages', () => {
                const validData = createValidPostSponsorship();
                const invalidMessages = [
                    '', // Empty
                    'Hi', // Too short (min 5)
                    'A'.repeat(301) // Too long (max 300)
                ];

                for (const message of invalidMessages) {
                    const data = { ...validData, message };
                    expect(() => PostSponsorshipSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('description field', () => {
            it('should accept valid descriptions', () => {
                const validData = createValidPostSponsorship();
                const validDescriptions = [
                    'A'.repeat(10), // Minimum length
                    'Valid description with enough characters to meet requirements.',
                    'A'.repeat(500) // Maximum length
                ];

                for (const description of validDescriptions) {
                    const data = { ...validData, description };
                    expect(() => PostSponsorshipSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid descriptions', () => {
                const validData = createValidPostSponsorship();
                const invalidDescriptions = [
                    '', // Empty
                    'Short', // Too short (min 10)
                    'A'.repeat(501) // Too long (max 500)
                ];

                for (const description of invalidDescriptions) {
                    const data = { ...validData, description };
                    expect(() => PostSponsorshipSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('paid field', () => {
            it('should accept valid paid objects', () => {
                const validData = createValidPostSponsorship();
                const validPaidObjects = [
                    { price: 100.5, currency: 'USD' },
                    { price: 0.01, currency: 'ARS' }, // Minimum positive price
                    { price: 999999.99, currency: 'USD' } // Large price
                ];

                for (const paid of validPaidObjects) {
                    const data = { ...validData, paid };
                    expect(() => PostSponsorshipSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid paid objects', () => {
                const validData = createValidPostSponsorship();
                const invalidPaidObjects = [
                    { price: -100, currency: 'USD' }, // Negative price
                    { price: 0, currency: 'USD' }, // Zero price
                    { price: 100.5, currency: 'INVALID' }, // Invalid currency
                    { currency: 'USD' }, // Missing price
                    { price: 100.5 } // Missing currency
                ];

                for (const paid of invalidPaidObjects) {
                    const data = { ...validData, paid };
                    expect(() => PostSponsorshipSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('date fields', () => {
            it('should accept valid dates', () => {
                const validData = createValidPostSponsorship();
                const validDates = [
                    undefined, // Optional fields
                    new Date(),
                    new Date('2024-01-01'),
                    new Date('2025-12-31')
                ];

                for (const date of validDates) {
                    const data = {
                        ...validData,
                        paidAt: date,
                        fromDate: date,
                        toDate: date
                    };
                    expect(() => PostSponsorshipSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid dates', () => {
                const validData = createValidPostSponsorship();
                const invalidDates = [
                    'invalid-date',
                    '2024-13-01', // Invalid month
                    123456789 // Number instead of Date
                ];

                for (const date of invalidDates) {
                    const data = { ...validData, paidAt: date };
                    expect(() => PostSponsorshipSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('isHighlighted field', () => {
            it('should accept boolean values', () => {
                const validData = createValidPostSponsorship();
                const booleanValues = [true, false];

                for (const isHighlighted of booleanValues) {
                    const data = { ...validData, isHighlighted };
                    expect(() => PostSponsorshipSchema.parse(data)).not.toThrow();
                }
            });

            it('should default to false', () => {
                const validData = createMinimalPostSponsorship();
                const result = PostSponsorshipSchema.parse(validData);
                expect(result.isHighlighted).toBe(false);
            });

            it('should reject non-boolean values', () => {
                const validData = createValidPostSponsorship();
                const invalidValues = ['true', 'false', 1, 0, null];

                for (const isHighlighted of invalidValues) {
                    const data = { ...validData, isHighlighted };
                    expect(() => PostSponsorshipSchema.parse(data)).toThrow(ZodError);
                }
            });
        });
    });

    describe('Optional Fields', () => {
        it('should handle optional fields correctly', () => {
            const baseData = createMinimalPostSponsorship();

            // Should work without optional fields
            expect(() => PostSponsorshipSchema.parse(baseData)).not.toThrow();

            // Should work with optional fields
            const withOptionals = {
                ...baseData,
                message: 'Sponsorship message',
                paidAt: new Date(),
                fromDate: new Date(),
                toDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days later
                isHighlighted: true
            };

            expect(() => PostSponsorshipSchema.parse(withOptionals)).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should handle edge case values', () => {
            const validData = createPostSponsorshipEdgeCases();

            expect(() => PostSponsorshipSchema.parse(validData)).not.toThrow();

            const result = PostSponsorshipSchema.parse(validData);
            expect(result.description).toBeDefined();
            expect(result.paid.price).toBeGreaterThan(0);
        });

        it('should handle null vs undefined for optional fields', () => {
            const validData = createValidPostSponsorship();

            // undefined should work for optional fields
            const withUndefined = {
                ...validData,
                message: undefined,
                paidAt: undefined,
                fromDate: undefined,
                toDate: undefined
            };
            expect(() => PostSponsorshipSchema.parse(withUndefined)).not.toThrow();
        });
    });

    describe('Type Inference', () => {
        it('should infer correct TypeScript types', () => {
            const validData = createValidPostSponsorship();
            const result = PostSponsorshipSchema.parse(validData);

            // TypeScript should infer these correctly
            expect(typeof result.id).toBe('string');
            expect(typeof result.sponsorId).toBe('string');
            expect(typeof result.postId).toBe('string');
            expect(typeof result.description).toBe('string');
            expect(typeof result.paid.price).toBe('number');
            expect(typeof result.paid.currency).toBe('string');
            expect(typeof result.isHighlighted).toBe('boolean');

            // Optional fields
            if (result.message !== undefined) {
                expect(typeof result.message).toBe('string');
            }
            if (result.paidAt !== undefined) {
                expect(result.paidAt instanceof Date).toBe(true);
            }
        });
    });
});

import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { EventOrganizerSchema } from '../../../src/entities/eventOrganizer/eventOrganizer.schema.js';
import {
    createComplexEventOrganizer,
    createEventOrganizerEdgeCases,
    createEventOrganizerInvalidCases,
    createMinimalEventOrganizer,
    createValidEventOrganizer
} from '../../fixtures/eventOrganizer.fixtures.js';

describe('EventOrganizerSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid event organizer', () => {
            const validData = createValidEventOrganizer();

            expect(() => EventOrganizerSchema.parse(validData)).not.toThrow();

            const result = EventOrganizerSchema.parse(validData);
            expect(result).toMatchObject(validData);
        });

        it('should validate minimal required event organizer data', () => {
            const minimalData = createMinimalEventOrganizer();

            expect(() => EventOrganizerSchema.parse(minimalData)).not.toThrow();
        });

        it('should validate complex event organizer with all optional fields', () => {
            const complexData = createComplexEventOrganizer();

            expect(() => EventOrganizerSchema.parse(complexData)).not.toThrow();

            const result = EventOrganizerSchema.parse(complexData);
            expect(result.description).toBeDefined();
            expect(result.logo).toBeDefined();
            expect(result.contactInfo).toBeDefined();
            expect(result.socialNetworks).toBeDefined();
        });

        it('should validate event organizer edge cases', () => {
            const edgeCases = createEventOrganizerEdgeCases();

            edgeCases.forEach((edgeCase, index) => {
                expect(
                    () => EventOrganizerSchema.parse(edgeCase),
                    `Edge case ${index} should be valid`
                ).not.toThrow();
            });
        });
    });

    describe('Invalid Data', () => {
        it('should reject event organizer with invalid data', () => {
            const invalidCases = createEventOrganizerInvalidCases();

            // biome-ignore lint/complexity/noForEach: <explanation>
            invalidCases.forEach((invalidCase) => {
                expect(() => EventOrganizerSchema.parse(invalidCase)).toThrow(ZodError);
            });
        });

        it('should reject event organizer with missing required fields', () => {
            const incompleteData = {
                description: 'Test description',
                logo: 'https://example.com/logo.png'
            };

            expect(() => EventOrganizerSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject event organizer invalid cases', () => {
            const invalidCases = createEventOrganizerInvalidCases();

            // biome-ignore lint/complexity/noForEach: <explanation>
            invalidCases.forEach((invalidCase) => {
                expect(() => EventOrganizerSchema.parse(invalidCase)).toThrow(ZodError);
            });
        });
    });

    describe('Optional Fields', () => {
        it('should accept undefined optional fields', () => {
            const dataWithUndefinedOptionals = {
                ...createMinimalEventOrganizer(),
                description: undefined,
                logo: undefined,
                contactInfo: undefined,
                socialNetworks: undefined
            };

            expect(() => EventOrganizerSchema.parse(dataWithUndefinedOptionals)).not.toThrow();
        });

        it('should validate name field constraints', () => {
            const baseData = createMinimalEventOrganizer();

            // Valid name lengths
            expect(() => EventOrganizerSchema.parse({ ...baseData, name: 'ABC' })).not.toThrow();
            expect(() =>
                EventOrganizerSchema.parse({ ...baseData, name: 'A'.repeat(100) })
            ).not.toThrow();

            // Invalid name lengths
            expect(() => EventOrganizerSchema.parse({ ...baseData, name: 'AB' })).toThrow();
            expect(() =>
                EventOrganizerSchema.parse({ ...baseData, name: 'A'.repeat(101) })
            ).toThrow();
        });

        it('should validate description field constraints', () => {
            const baseData = createMinimalEventOrganizer();

            // Valid description lengths (when provided)
            expect(() =>
                EventOrganizerSchema.parse({
                    ...baseData,
                    description: 'A'.repeat(10)
                })
            ).not.toThrow();
            expect(() =>
                EventOrganizerSchema.parse({
                    ...baseData,
                    description: 'A'.repeat(500)
                })
            ).not.toThrow();

            // Invalid description lengths
            expect(() =>
                EventOrganizerSchema.parse({
                    ...baseData,
                    description: 'Short'
                })
            ).toThrow();
            expect(() =>
                EventOrganizerSchema.parse({
                    ...baseData,
                    description: 'A'.repeat(501)
                })
            ).toThrow();
        });

        it('should validate logo URL format', () => {
            const baseData = createMinimalEventOrganizer();

            // Valid URLs
            expect(() =>
                EventOrganizerSchema.parse({
                    ...baseData,
                    logo: 'https://example.com/logo.png'
                })
            ).not.toThrow();
            expect(() =>
                EventOrganizerSchema.parse({
                    ...baseData,
                    logo: 'http://example.com/logo.jpg'
                })
            ).not.toThrow();

            // Invalid URLs
            expect(() =>
                EventOrganizerSchema.parse({
                    ...baseData,
                    logo: 'not-a-url'
                })
            ).toThrow();
            expect(() =>
                EventOrganizerSchema.parse({
                    ...baseData,
                    logo: 'invalid-url-format'
                })
            ).toThrow();
        });
    });

    describe('Type Inference', () => {
        it('should infer correct TypeScript types', () => {
            const validData = createValidEventOrganizer();
            const parsed = EventOrganizerSchema.parse(validData);

            // Type assertions to ensure correct inference
            expect(typeof parsed.id).toBe('string');
            expect(typeof parsed.name).toBe('string');
            expect(typeof parsed.createdAt).toBe('object'); // Date
            expect(typeof parsed.updatedAt).toBe('object'); // Date

            if (parsed.description) {
                expect(typeof parsed.description).toBe('string');
            }

            if (parsed.logo) {
                expect(typeof parsed.logo).toBe('string');
            }
        });
    });
});

import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { EventLocationSchema } from '../../../src/entities/eventLocation/eventLocation.schema.js';
import {
    createComplexEventLocation,
    createEventLocationEdgeCases,
    createEventLocationInvalidCases,
    createInvalidEventLocation,
    createMinimalEventLocation,
    createValidEventLocation
} from '../../fixtures/eventLocation.fixtures.js';

describe('EventLocationSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid event location', () => {
            const validData = createValidEventLocation();

            expect(() => EventLocationSchema.parse(validData)).not.toThrow();

            const result = EventLocationSchema.parse(validData);
            expect(result).toBeDefined();
            expect(result.id).toBe(validData.id);
            expect(result.state).toBe(validData.state);
            expect(result.country).toBe(validData.country);
        });

        it('should validate minimal required event location data', () => {
            const minimalData = createMinimalEventLocation();

            expect(() => EventLocationSchema.parse(minimalData)).not.toThrow();
        });

        it('should validate complex event location with all optional fields', () => {
            const complexData = createComplexEventLocation();

            expect(() => EventLocationSchema.parse(complexData)).not.toThrow();

            const result = EventLocationSchema.parse(complexData);
            expect(result.street).toBeDefined();
            expect(result.number).toBeDefined();
            expect(result.floor).toBeDefined();
            expect(result.apartment).toBeDefined();
            expect(result.neighborhood).toBeDefined();
            expect(result.city).toBeDefined();
            expect(result.department).toBeDefined();
            expect(result.placeName).toBeDefined();
        });

        it('should validate event location edge cases', () => {
            const edgeCases = createEventLocationEdgeCases();

            edgeCases.forEach((edgeCase, index) => {
                expect(
                    () => EventLocationSchema.parse(edgeCase),
                    `Edge case ${index} should be valid`
                ).not.toThrow();
            });
        });
    });

    describe('Invalid Data', () => {
        it('should reject event location with invalid data', () => {
            const invalidData = createInvalidEventLocation();

            expect(() => EventLocationSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject event location with missing required fields', () => {
            const incompleteData = {
                // Missing required base fields like id, createdAt, etc.
                street: 'Test Street'
            };

            expect(() => EventLocationSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject event location invalid cases', () => {
            const invalidCases = createEventLocationInvalidCases();

            invalidCases.forEach((invalidCase, index) => {
                expect(
                    () => EventLocationSchema.parse(invalidCase),
                    `Invalid case ${index} should throw`
                ).toThrow(ZodError);
            });
        });
    });

    describe('Optional Fields', () => {
        it('should accept undefined optional fields', () => {
            const dataWithUndefinedOptionals = {
                ...createMinimalEventLocation(),
                street: undefined,
                number: undefined,
                floor: undefined,
                apartment: undefined,
                neighborhood: undefined,
                city: undefined,
                department: undefined,
                placeName: undefined
            };

            expect(() => EventLocationSchema.parse(dataWithUndefinedOptionals)).not.toThrow();
        });

        it('should validate street field constraints', () => {
            const baseData = createMinimalEventLocation();

            // Valid street
            expect(() =>
                EventLocationSchema.parse({
                    ...baseData,
                    street: 'Main Street'
                })
            ).not.toThrow();

            // Too short street
            expect(() =>
                EventLocationSchema.parse({
                    ...baseData,
                    street: 'A'
                })
            ).toThrow(ZodError);

            // Too long street
            expect(() =>
                EventLocationSchema.parse({
                    ...baseData,
                    street: 'A'.repeat(60)
                })
            ).toThrow(ZodError);
        });

        it('should validate number field constraints', () => {
            const baseData = createMinimalEventLocation();

            // Valid number
            expect(() =>
                EventLocationSchema.parse({
                    ...baseData,
                    number: '123'
                })
            ).not.toThrow();

            // Too long number
            expect(() =>
                EventLocationSchema.parse({
                    ...baseData,
                    number: '1'.repeat(15)
                })
            ).toThrow(ZodError);
        });

        it('should validate city field constraints', () => {
            const baseData = createMinimalEventLocation();

            // Valid city
            expect(() =>
                EventLocationSchema.parse({
                    ...baseData,
                    city: 'New York'
                })
            ).not.toThrow();

            // Too short city
            expect(() =>
                EventLocationSchema.parse({
                    ...baseData,
                    city: 'A'
                })
            ).toThrow(ZodError);

            // Too long city
            expect(() =>
                EventLocationSchema.parse({
                    ...baseData,
                    city: 'A'.repeat(60)
                })
            ).toThrow(ZodError);
        });

        it('should validate placeName field constraints', () => {
            const baseData = createMinimalEventLocation();

            // Valid placeName
            expect(() =>
                EventLocationSchema.parse({
                    ...baseData,
                    placeName: 'Central Park'
                })
            ).not.toThrow();

            // Too short placeName
            expect(() =>
                EventLocationSchema.parse({
                    ...baseData,
                    placeName: 'A'
                })
            ).toThrow(ZodError);

            // Too long placeName
            expect(() =>
                EventLocationSchema.parse({
                    ...baseData,
                    placeName: 'A'.repeat(120)
                })
            ).toThrow(ZodError);
        });
    });

    describe('Type Inference', () => {
        it('should infer correct TypeScript types', () => {
            const validData = createValidEventLocation();
            const result = EventLocationSchema.parse(validData);

            // Type checks (these will fail at compile time if types are wrong)
            expect(typeof result.id).toBe('string');
            expect(typeof result.createdAt).toBe('object'); // Date
            expect(typeof result.updatedAt).toBe('object'); // Date
            expect(typeof result.lifecycleState).toBe('string');

            // Optional fields
            if (result.street) expect(typeof result.street).toBe('string');
            if (result.number) expect(typeof result.number).toBe('string');
            if (result.floor) expect(typeof result.floor).toBe('string');
            if (result.apartment) expect(typeof result.apartment).toBe('string');
            if (result.neighborhood) expect(typeof result.neighborhood).toBe('string');
            if (result.city) expect(typeof result.city).toBe('string');
            if (result.department) expect(typeof result.department).toBe('string');
            if (result.placeName) expect(typeof result.placeName).toBe('string');
        });
    });
});

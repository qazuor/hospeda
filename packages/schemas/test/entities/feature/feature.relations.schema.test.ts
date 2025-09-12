import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AddFeatureToAccommodationInputSchema,
    GetAccommodationsByFeatureSchema,
    GetFeaturesForAccommodationSchema,
    RemoveFeatureFromAccommodationInputSchema
} from '../../../src/entities/feature/feature.relations.schema.js';

describe('Feature Relations Schemas - Accommodation-Feature Operations', () => {
    describe('AddFeatureToAccommodationInputSchema', () => {
        it('should validate valid input with all fields', () => {
            const validInput = {
                accommodationId: faker.string.uuid(),
                featureId: faker.string.uuid(),
                hostReWriteName: faker.lorem.words(3),
                comments: faker.lorem.sentence()
            };

            expect(() => AddFeatureToAccommodationInputSchema.parse(validInput)).not.toThrow();

            const result = AddFeatureToAccommodationInputSchema.parse(validInput);
            expect(result.accommodationId).toBe(validInput.accommodationId);
            expect(result.featureId).toBe(validInput.featureId);
            expect(result.hostReWriteName).toBe(validInput.hostReWriteName);
            expect(result.comments).toBe(validInput.comments);
        });

        it('should validate valid input with only required fields', () => {
            const validInput = {
                accommodationId: faker.string.uuid(),
                featureId: faker.string.uuid()
            };

            expect(() => AddFeatureToAccommodationInputSchema.parse(validInput)).not.toThrow();

            const result = AddFeatureToAccommodationInputSchema.parse(validInput);
            expect(result.accommodationId).toBe(validInput.accommodationId);
            expect(result.featureId).toBe(validInput.featureId);
            expect(result.hostReWriteName).toBeUndefined();
            expect(result.comments).toBeUndefined();
        });

        it('should allow null values for optional fields', () => {
            const validInput = {
                accommodationId: faker.string.uuid(),
                featureId: faker.string.uuid(),
                hostReWriteName: null,
                comments: null
            };

            expect(() => AddFeatureToAccommodationInputSchema.parse(validInput)).not.toThrow();

            const result = AddFeatureToAccommodationInputSchema.parse(validInput);
            expect(result.hostReWriteName).toBeNull();
            expect(result.comments).toBeNull();
        });

        it('should reject empty accommodation ID', () => {
            const invalidInput = {
                accommodationId: '',
                featureId: faker.string.uuid()
            };

            expect(() => AddFeatureToAccommodationInputSchema.parse(invalidInput)).toThrow(
                ZodError
            );
        });

        it('should reject empty feature ID', () => {
            const invalidInput = {
                accommodationId: faker.string.uuid(),
                featureId: ''
            };

            expect(() => AddFeatureToAccommodationInputSchema.parse(invalidInput)).toThrow(
                ZodError
            );
        });

        it('should reject missing required fields', () => {
            const invalidInputs = [
                { featureId: faker.string.uuid() }, // Missing accommodationId
                { accommodationId: faker.string.uuid() }, // Missing featureId
                {} // Missing both
            ];

            for (const input of invalidInputs) {
                expect(() => AddFeatureToAccommodationInputSchema.parse(input)).toThrow(ZodError);
            }
        });

        it('should reject hostReWriteName that is too short', () => {
            const invalidInput = {
                accommodationId: faker.string.uuid(),
                featureId: faker.string.uuid(),
                hostReWriteName: 'ab' // Less than 3 characters
            };

            expect(() => AddFeatureToAccommodationInputSchema.parse(invalidInput)).toThrow(
                ZodError
            );
        });

        it('should reject hostReWriteName that is too long', () => {
            const invalidInput = {
                accommodationId: faker.string.uuid(),
                featureId: faker.string.uuid(),
                hostReWriteName: 'a'.repeat(101) // More than 100 characters
            };

            expect(() => AddFeatureToAccommodationInputSchema.parse(invalidInput)).toThrow(
                ZodError
            );
        });

        it('should reject comments that are too short', () => {
            const invalidInput = {
                accommodationId: faker.string.uuid(),
                featureId: faker.string.uuid(),
                comments: 'abc' // Less than 5 characters
            };

            expect(() => AddFeatureToAccommodationInputSchema.parse(invalidInput)).toThrow(
                ZodError
            );
        });

        it('should reject comments that are too long', () => {
            const invalidInput = {
                accommodationId: faker.string.uuid(),
                featureId: faker.string.uuid(),
                comments: 'a'.repeat(301) // More than 300 characters
            };

            expect(() => AddFeatureToAccommodationInputSchema.parse(invalidInput)).toThrow(
                ZodError
            );
        });

        it('should reject extra fields due to strict mode', () => {
            const invalidInput = {
                accommodationId: faker.string.uuid(),
                featureId: faker.string.uuid(),
                extraField: 'not allowed'
            };

            expect(() => AddFeatureToAccommodationInputSchema.parse(invalidInput)).toThrow(
                ZodError
            );
        });
    });

    describe('RemoveFeatureFromAccommodationInputSchema', () => {
        it('should validate valid input', () => {
            const validInput = {
                accommodationId: faker.string.uuid(),
                featureId: faker.string.uuid()
            };

            expect(() => RemoveFeatureFromAccommodationInputSchema.parse(validInput)).not.toThrow();

            const result = RemoveFeatureFromAccommodationInputSchema.parse(validInput);
            expect(result.accommodationId).toBe(validInput.accommodationId);
            expect(result.featureId).toBe(validInput.featureId);
        });

        it('should reject empty accommodation ID', () => {
            const invalidInput = {
                accommodationId: '',
                featureId: faker.string.uuid()
            };

            expect(() => RemoveFeatureFromAccommodationInputSchema.parse(invalidInput)).toThrow(
                ZodError
            );
        });

        it('should reject empty feature ID', () => {
            const invalidInput = {
                accommodationId: faker.string.uuid(),
                featureId: ''
            };

            expect(() => RemoveFeatureFromAccommodationInputSchema.parse(invalidInput)).toThrow(
                ZodError
            );
        });

        it('should reject missing required fields', () => {
            const invalidInputs = [
                { featureId: faker.string.uuid() }, // Missing accommodationId
                { accommodationId: faker.string.uuid() }, // Missing featureId
                {} // Missing both
            ];

            for (const input of invalidInputs) {
                expect(() => RemoveFeatureFromAccommodationInputSchema.parse(input)).toThrow(
                    ZodError
                );
            }
        });

        it('should reject extra fields due to strict mode', () => {
            const invalidInput = {
                accommodationId: faker.string.uuid(),
                featureId: faker.string.uuid(),
                extraField: 'not allowed'
            };

            expect(() => RemoveFeatureFromAccommodationInputSchema.parse(invalidInput)).toThrow(
                ZodError
            );
        });
    });

    describe('GetFeaturesForAccommodationSchema', () => {
        it('should validate valid input', () => {
            const validInput = {
                accommodationId: faker.string.uuid()
            };

            expect(() => GetFeaturesForAccommodationSchema.parse(validInput)).not.toThrow();

            const result = GetFeaturesForAccommodationSchema.parse(validInput);
            expect(result.accommodationId).toBe(validInput.accommodationId);
        });

        it('should reject empty accommodation ID', () => {
            const invalidInput = {
                accommodationId: ''
            };

            expect(() => GetFeaturesForAccommodationSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject missing accommodation ID', () => {
            const invalidInput = {};

            expect(() => GetFeaturesForAccommodationSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject extra fields due to strict mode', () => {
            const invalidInput = {
                accommodationId: faker.string.uuid(),
                extraField: 'not allowed'
            };

            expect(() => GetFeaturesForAccommodationSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('GetAccommodationsByFeatureSchema', () => {
        it('should validate valid input', () => {
            const validInput = {
                featureId: faker.string.uuid()
            };

            expect(() => GetAccommodationsByFeatureSchema.parse(validInput)).not.toThrow();

            const result = GetAccommodationsByFeatureSchema.parse(validInput);
            expect(result.featureId).toBe(validInput.featureId);
        });

        it('should reject empty feature ID', () => {
            const invalidInput = {
                featureId: ''
            };

            expect(() => GetAccommodationsByFeatureSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject missing feature ID', () => {
            const invalidInput = {};

            expect(() => GetAccommodationsByFeatureSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject extra fields due to strict mode', () => {
            const invalidInput = {
                featureId: faker.string.uuid(),
                extraField: 'not allowed'
            };

            expect(() => GetAccommodationsByFeatureSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('Edge Cases and Integration', () => {
        it('should handle UUID format validation', () => {
            const validUuids = [
                faker.string.uuid(),
                '123e4567-e89b-12d3-a456-426614174000',
                'f47ac10b-58cc-4372-a567-0e02b2c3d479'
            ];

            for (const uuid of validUuids) {
                const input = {
                    accommodationId: uuid,
                    featureId: uuid
                };

                expect(() => AddFeatureToAccommodationInputSchema.parse(input)).not.toThrow();
                expect(() => RemoveFeatureFromAccommodationInputSchema.parse(input)).not.toThrow();
                expect(() =>
                    GetFeaturesForAccommodationSchema.parse({ accommodationId: uuid })
                ).not.toThrow();
                expect(() =>
                    GetAccommodationsByFeatureSchema.parse({ featureId: uuid })
                ).not.toThrow();
            }
        });

        it('should handle boundary values for optional string fields', () => {
            const boundaryTests = [
                {
                    hostReWriteName: 'abc', // Minimum length (3)
                    comments: 'abcde' // Minimum length (5)
                },
                {
                    hostReWriteName: 'a'.repeat(100), // Maximum length (100)
                    comments: 'a'.repeat(300) // Maximum length (300)
                }
            ];

            for (const test of boundaryTests) {
                const input = {
                    accommodationId: faker.string.uuid(),
                    featureId: faker.string.uuid(),
                    ...test
                };

                expect(() => AddFeatureToAccommodationInputSchema.parse(input)).not.toThrow();
            }
        });

        it('should validate all schemas with same IDs for consistency', () => {
            const accommodationId = faker.string.uuid();
            const featureId = faker.string.uuid();

            // All schemas should accept the same valid IDs
            expect(() =>
                AddFeatureToAccommodationInputSchema.parse({
                    accommodationId,
                    featureId
                })
            ).not.toThrow();

            expect(() =>
                RemoveFeatureFromAccommodationInputSchema.parse({
                    accommodationId,
                    featureId
                })
            ).not.toThrow();

            expect(() =>
                GetFeaturesForAccommodationSchema.parse({
                    accommodationId
                })
            ).not.toThrow();

            expect(() =>
                GetAccommodationsByFeatureSchema.parse({
                    featureId
                })
            ).not.toThrow();
        });
    });
});

import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    PointOfInterestAddToDestinationInputSchema,
    PointOfInterestCreateInputSchema,
    PointOfInterestCreateOutputSchema,
    PointOfInterestDeleteInputSchema,
    PointOfInterestDeleteOutputSchema,
    PointOfInterestDestinationRelationOutputSchema,
    PointOfInterestRemoveFromDestinationInputSchema,
    PointOfInterestRestoreInputSchema,
    PointOfInterestRestoreOutputSchema,
    PointOfInterestUpdateInputSchema,
    PointOfInterestUpdateOutputSchema,
    PointOfInterestViewOutputSchema
} from '../../../src/entities/point-of-interest/point-of-interest.crud.schema.js';
import {
    createValidPointOfInterest,
    createValidPointOfInterestCreateInput,
    createValidPointOfInterestDestinationRelation,
    createValidPointOfInterestUpdateInput
} from '../../fixtures/point-of-interest.fixtures.js';

describe('Point Of Interest CRUD Schemas', () => {
    describe('PointOfInterestCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const validInput = createValidPointOfInterestCreateInput();

            expect(() => PointOfInterestCreateInputSchema.parse(validInput)).not.toThrow();

            const result = PointOfInterestCreateInputSchema.parse(validInput);
            expect(result).toMatchObject(validInput);
        });

        it('should reject server-generated fields but still validate', () => {
            const inputWithServerFields = {
                ...createValidPointOfInterestCreateInput(),
                id: faker.string.uuid(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = PointOfInterestCreateInputSchema.parse(inputWithServerFields);
            expect(result).not.toHaveProperty('id');
            expect(result).not.toHaveProperty('createdAt');
            expect(result).not.toHaveProperty('updatedAt');
        });

        it('should require slug on create (the i18n key, HOS-113 OQ-2)', () => {
            const { slug, ...incompleteInput } = createValidPointOfInterestCreateInput();

            expect(() => PointOfInterestCreateInputSchema.parse(incompleteInput)).toThrow(ZodError);
        });

        it('should require type on create', () => {
            const { type, ...incompleteInput } = createValidPointOfInterestCreateInput();

            expect(() => PointOfInterestCreateInputSchema.parse(incompleteInput)).toThrow(ZodError);
        });

        it('should validate slug pattern when provided', () => {
            const inputWithInvalidSlug = {
                ...createValidPointOfInterestCreateInput(),
                slug: 'Invalid Slug With Spaces'
            };

            expect(() => PointOfInterestCreateInputSchema.parse(inputWithInvalidSlug)).toThrow(
                ZodError
            );
        });

        it('should not accept a `name` field as part of the shape', () => {
            const inputWithName = {
                ...createValidPointOfInterestCreateInput(),
                name: 'Should be stripped'
            };

            const result = PointOfInterestCreateInputSchema.parse(inputWithName);
            expect(result).not.toHaveProperty('name');
        });
    });

    describe('PointOfInterestUpdateInputSchema', () => {
        it('should validate valid update input', () => {
            const validInput = createValidPointOfInterestUpdateInput();

            expect(() => PointOfInterestUpdateInputSchema.parse(validInput)).not.toThrow();
        });

        it('should allow partial updates', () => {
            const partialInput = {
                description: 'Updated description only, long enough to pass validation'
            };

            expect(() => PointOfInterestUpdateInputSchema.parse(partialInput)).not.toThrow();
        });

        it('should allow empty update object', () => {
            const emptyInput = {};

            expect(() => PointOfInterestUpdateInputSchema.parse(emptyInput)).not.toThrow();
        });

        it('should validate fields when provided', () => {
            const inputWithInvalidLat = { lat: 999 };

            expect(() => PointOfInterestUpdateInputSchema.parse(inputWithInvalidLat)).toThrow(
                ZodError
            );
        });

        it('should validate type when provided', () => {
            const inputWithInvalidType = { type: 'NOT_A_TYPE' };

            expect(() => PointOfInterestUpdateInputSchema.parse(inputWithInvalidType)).toThrow(
                ZodError
            );
        });
    });

    describe('PointOfInterestDeleteInputSchema', () => {
        it('should validate valid delete input', () => {
            const validInput = { id: faker.string.uuid() };

            expect(() => PointOfInterestDeleteInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require id field', () => {
            expect(() => PointOfInterestDeleteInputSchema.parse({})).toThrow(ZodError);
        });
    });

    describe('PointOfInterestRestoreInputSchema', () => {
        it('should validate valid restore input', () => {
            const validInput = { id: faker.string.uuid() };

            expect(() => PointOfInterestRestoreInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require id field', () => {
            expect(() => PointOfInterestRestoreInputSchema.parse({})).toThrow(ZodError);
        });
    });

    describe('Output Schemas', () => {
        it('should validate valid create output', () => {
            const validOutput = { pointOfInterest: createValidPointOfInterest() };

            expect(() => PointOfInterestCreateOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should validate valid update output', () => {
            const validOutput = { pointOfInterest: createValidPointOfInterest() };

            expect(() => PointOfInterestUpdateOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should validate valid delete output', () => {
            const validOutput = { pointOfInterest: createValidPointOfInterest() };

            expect(() => PointOfInterestDeleteOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should validate valid restore output', () => {
            const validOutput = { pointOfInterest: createValidPointOfInterest() };

            expect(() => PointOfInterestRestoreOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should validate valid view output', () => {
            const validOutput = { pointOfInterest: createValidPointOfInterest() };

            expect(() => PointOfInterestViewOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should allow null point of interest in view output', () => {
            const nullOutput = { pointOfInterest: null };

            expect(() => PointOfInterestViewOutputSchema.parse(nullOutput)).not.toThrow();
        });
    });

    describe('Relation Schemas', () => {
        describe('PointOfInterestAddToDestinationInputSchema', () => {
            it('should validate valid add relation input', () => {
                const validInput = {
                    destinationId: faker.string.uuid(),
                    pointOfInterestId: faker.string.uuid()
                };

                expect(() =>
                    PointOfInterestAddToDestinationInputSchema.parse(validInput)
                ).not.toThrow();
            });

            it('should require both IDs', () => {
                const incompleteInput = { destinationId: faker.string.uuid() };

                expect(() =>
                    PointOfInterestAddToDestinationInputSchema.parse(incompleteInput)
                ).toThrow(ZodError);
            });

            it('should validate UUID formats', () => {
                const invalidInput = {
                    destinationId: 'invalid-uuid',
                    pointOfInterestId: faker.string.uuid()
                };

                expect(() =>
                    PointOfInterestAddToDestinationInputSchema.parse(invalidInput)
                ).toThrow(ZodError);
            });
        });

        describe('PointOfInterestRemoveFromDestinationInputSchema', () => {
            it('should validate valid remove relation input', () => {
                const validInput = {
                    destinationId: faker.string.uuid(),
                    pointOfInterestId: faker.string.uuid()
                };

                expect(() =>
                    PointOfInterestRemoveFromDestinationInputSchema.parse(validInput)
                ).not.toThrow();
            });

            it('should require both IDs', () => {
                const incompleteInput = { pointOfInterestId: faker.string.uuid() };

                expect(() =>
                    PointOfInterestRemoveFromDestinationInputSchema.parse(incompleteInput)
                ).toThrow(ZodError);
            });
        });

        describe('PointOfInterestDestinationRelationOutputSchema', () => {
            it('should validate valid relation output', () => {
                const validOutput = {
                    success: true,
                    relation: createValidPointOfInterestDestinationRelation()
                };

                expect(() =>
                    PointOfInterestDestinationRelationOutputSchema.parse(validOutput)
                ).not.toThrow();
            });

            it('should default success to true', () => {
                const outputWithoutSuccess = {
                    relation: createValidPointOfInterestDestinationRelation()
                };

                const result =
                    PointOfInterestDestinationRelationOutputSchema.parse(outputWithoutSuccess);
                expect(result.success).toBe(true);
            });

            it('should allow optional timestamp fields in relation', () => {
                const outputWithoutTimestamps = {
                    success: true,
                    relation: {
                        destinationId: faker.string.uuid(),
                        pointOfInterestId: faker.string.uuid()
                    }
                };

                expect(() =>
                    PointOfInterestDestinationRelationOutputSchema.parse(outputWithoutTimestamps)
                ).not.toThrow();
            });
        });
    });
});

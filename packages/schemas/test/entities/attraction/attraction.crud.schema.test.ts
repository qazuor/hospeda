import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AttractionAddToDestinationInputSchema,
    AttractionCreateInputSchema,
    AttractionCreateOutputSchema,
    AttractionDeleteInputSchema,
    AttractionDeleteOutputSchema,
    AttractionDestinationRelationOutputSchema,
    AttractionRemoveFromDestinationInputSchema,
    AttractionRestoreInputSchema,
    AttractionRestoreOutputSchema,
    AttractionUpdateInputSchema,
    AttractionUpdateOutputSchema,
    AttractionViewOutputSchema
} from '../../../src/entities/attraction/attraction.crud.schema.js';
import {
    createValidAttraction,
    createValidAttractionCreateInput,
    createValidAttractionDestinationRelation,
    createValidAttractionUpdateInput
} from '../../fixtures/attraction.fixtures.js';

describe('Attraction CRUD Schemas', () => {
    describe('AttractionCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const validInput = createValidAttractionCreateInput();

            expect(() => AttractionCreateInputSchema.parse(validInput)).not.toThrow();

            const result = AttractionCreateInputSchema.parse(validInput);
            expect(result).toMatchObject(validInput);
        });

        it('should allow optional slug on create', () => {
            const inputWithoutSlug = {
                ...createValidAttractionCreateInput(),
                slug: undefined
            };

            expect(() => AttractionCreateInputSchema.parse(inputWithoutSlug)).not.toThrow();
        });

        it('should allow optional destinationId on create', () => {
            const inputWithoutDestination = {
                ...createValidAttractionCreateInput(),
                destinationId: undefined
            };

            expect(() => AttractionCreateInputSchema.parse(inputWithoutDestination)).not.toThrow();
        });

        it('should reject server-generated fields', () => {
            const inputWithServerFields = {
                ...createValidAttractionCreateInput(),
                id: faker.string.uuid(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Should not throw because server fields are omitted, not rejected
            const result = AttractionCreateInputSchema.parse(inputWithServerFields);
            expect(result).not.toHaveProperty('id');
            expect(result).not.toHaveProperty('createdAt');
            expect(result).not.toHaveProperty('updatedAt');
        });

        it('should require essential fields', () => {
            const incompleteInput = {
                name: 'Test Attraction'
                // Missing description, icon
            };

            expect(() => AttractionCreateInputSchema.parse(incompleteInput)).toThrow(ZodError);
        });

        it('should validate slug pattern when provided', () => {
            const inputWithInvalidSlug = {
                ...createValidAttractionCreateInput(),
                slug: 'Invalid Slug With Spaces'
            };

            expect(() => AttractionCreateInputSchema.parse(inputWithInvalidSlug)).toThrow(ZodError);
        });
    });

    describe('AttractionUpdateInputSchema', () => {
        it('should validate valid update input', () => {
            const validInput = createValidAttractionUpdateInput();

            expect(() => AttractionUpdateInputSchema.parse(validInput)).not.toThrow();
        });

        it('should allow partial updates', () => {
            const partialInput = {
                name: 'Updated Name Only'
            };

            expect(() => AttractionUpdateInputSchema.parse(partialInput)).not.toThrow();
        });

        it('should allow empty update object', () => {
            const emptyInput = {};

            expect(() => AttractionUpdateInputSchema.parse(emptyInput)).not.toThrow();
        });

        it('should validate fields when provided', () => {
            const inputWithInvalidName = {
                name: 'ab' // Too short
            };

            expect(() => AttractionUpdateInputSchema.parse(inputWithInvalidName)).toThrow(ZodError);
        });
    });

    describe('AttractionDeleteInputSchema', () => {
        it('should validate valid delete input', () => {
            const validInput = {
                id: faker.string.uuid()
            };

            expect(() => AttractionDeleteInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require id field', () => {
            const invalidInput = {};

            expect(() => AttractionDeleteInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should validate id format', () => {
            const invalidInput = {
                id: 'invalid-uuid'
            };

            expect(() => AttractionDeleteInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('AttractionRestoreInputSchema', () => {
        it('should validate valid restore input', () => {
            const validInput = {
                id: faker.string.uuid()
            };

            expect(() => AttractionRestoreInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require id field', () => {
            const invalidInput = {};

            expect(() => AttractionRestoreInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('Output Schemas', () => {
        describe('AttractionCreateOutputSchema', () => {
            it('should validate valid create output', () => {
                const validOutput = {
                    attraction: createValidAttraction()
                };

                expect(() => AttractionCreateOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should require attraction field', () => {
                const invalidOutput = {};

                expect(() => AttractionCreateOutputSchema.parse(invalidOutput)).toThrow(ZodError);
            });
        });

        describe('AttractionUpdateOutputSchema', () => {
            it('should validate valid update output', () => {
                const validOutput = {
                    attraction: createValidAttraction()
                };

                expect(() => AttractionUpdateOutputSchema.parse(validOutput)).not.toThrow();
            });
        });

        describe('AttractionDeleteOutputSchema', () => {
            it('should validate valid delete output', () => {
                const validOutput = {
                    attraction: createValidAttraction()
                };

                expect(() => AttractionDeleteOutputSchema.parse(validOutput)).not.toThrow();
            });
        });

        describe('AttractionRestoreOutputSchema', () => {
            it('should validate valid restore output', () => {
                const validOutput = {
                    attraction: createValidAttraction()
                };

                expect(() => AttractionRestoreOutputSchema.parse(validOutput)).not.toThrow();
            });
        });

        describe('AttractionViewOutputSchema', () => {
            it('should validate valid view output', () => {
                const validOutput = {
                    attraction: createValidAttraction()
                };

                expect(() => AttractionViewOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should allow null attraction', () => {
                const nullOutput = {
                    attraction: null
                };

                expect(() => AttractionViewOutputSchema.parse(nullOutput)).not.toThrow();
            });
        });
    });

    describe('Relation Schemas', () => {
        describe('AttractionAddToDestinationInputSchema', () => {
            it('should validate valid add relation input', () => {
                const validInput = {
                    destinationId: faker.string.uuid(),
                    attractionId: faker.string.uuid()
                };

                expect(() => AttractionAddToDestinationInputSchema.parse(validInput)).not.toThrow();
            });

            it('should require both IDs', () => {
                const incompleteInput = {
                    destinationId: faker.string.uuid()
                    // Missing attractionId
                };

                expect(() => AttractionAddToDestinationInputSchema.parse(incompleteInput)).toThrow(
                    ZodError
                );
            });

            it('should validate UUID formats', () => {
                const invalidInput = {
                    destinationId: 'invalid-uuid',
                    attractionId: faker.string.uuid()
                };

                expect(() => AttractionAddToDestinationInputSchema.parse(invalidInput)).toThrow(
                    ZodError
                );
            });
        });

        describe('AttractionRemoveFromDestinationInputSchema', () => {
            it('should validate valid remove relation input', () => {
                const validInput = {
                    destinationId: faker.string.uuid(),
                    attractionId: faker.string.uuid()
                };

                expect(() =>
                    AttractionRemoveFromDestinationInputSchema.parse(validInput)
                ).not.toThrow();
            });

            it('should require both IDs', () => {
                const incompleteInput = {
                    attractionId: faker.string.uuid()
                    // Missing destinationId
                };

                expect(() =>
                    AttractionRemoveFromDestinationInputSchema.parse(incompleteInput)
                ).toThrow(ZodError);
            });
        });

        describe('AttractionDestinationRelationOutputSchema', () => {
            it('should validate valid relation output', () => {
                const validOutput = {
                    success: true,
                    relation: createValidAttractionDestinationRelation()
                };

                expect(() =>
                    AttractionDestinationRelationOutputSchema.parse(validOutput)
                ).not.toThrow();
            });

            it('should default success to true', () => {
                const outputWithoutSuccess = {
                    relation: createValidAttractionDestinationRelation()
                };

                const result =
                    AttractionDestinationRelationOutputSchema.parse(outputWithoutSuccess);
                expect(result.success).toBe(true);
            });

            it('should allow optional timestamp fields in relation', () => {
                const outputWithoutTimestamps = {
                    success: true,
                    relation: {
                        destinationId: faker.string.uuid(),
                        attractionId: faker.string.uuid()
                    }
                };

                expect(() =>
                    AttractionDestinationRelationOutputSchema.parse(outputWithoutTimestamps)
                ).not.toThrow();
            });
        });
    });

    describe('Schema Integration', () => {
        it('should work with complete CRUD flow types', () => {
            // Create
            const createInput = createValidAttractionCreateInput();
            const parsedCreateInput = AttractionCreateInputSchema.parse(createInput);
            expect(parsedCreateInput).toBeDefined();

            // Update
            const updateInput = createValidAttractionUpdateInput();
            const parsedUpdateInput = AttractionUpdateInputSchema.parse(updateInput);
            expect(parsedUpdateInput).toBeDefined();

            // Delete
            const deleteInput = { id: faker.string.uuid() };
            const parsedDeleteInput = AttractionDeleteInputSchema.parse(deleteInput);
            expect(parsedDeleteInput).toBeDefined();

            // Outputs
            const attraction = createValidAttraction();
            const createOutput = { attraction };
            const parsedCreateOutput = AttractionCreateOutputSchema.parse(createOutput);
            expect(parsedCreateOutput).toBeDefined();
        });
    });
});

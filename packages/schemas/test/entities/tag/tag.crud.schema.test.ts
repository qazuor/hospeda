import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    TagAddToEntityInputSchema,
    TagAddToEntityOutputSchema,
    TagCreateInputSchema,
    TagCreateOutputSchema,
    TagDeleteInputSchema,
    TagDeleteOutputSchema,
    TagGetEntitiesByTagInputSchema,
    TagGetEntitiesByTagOutputSchema,
    TagGetForEntityInputSchema,
    TagGetForEntityOutputSchema,
    TagRemoveFromEntityInputSchema,
    TagRemoveFromEntityOutputSchema,
    TagRestoreInputSchema,
    TagRestoreOutputSchema,
    TagUpdateInputSchema,
    TagUpdateOutputSchema
} from '../../../src/entities/tag/tag.crud.schema.js';
import {
    createTagCreateInput,
    createTagUpdateInput,
    createValidTag
} from '../../fixtures/tag.fixtures.js';

describe('Tag CRUD Schemas', () => {
    describe('TagCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const validInput = createTagCreateInput();

            expect(() => TagCreateInputSchema.parse(validInput)).not.toThrow();

            const result = TagCreateInputSchema.parse(validInput);
            expect(result.name).toBeDefined();
            expect(result.slug).toBeDefined();
            expect(result.color).toBeDefined();
        });

        it('should reject create input with auto-generated fields', () => {
            const invalidInput = {
                ...createTagCreateInput(),
                id: 'auto-generated-id',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(() => TagCreateInputSchema.strict().parse(invalidInput)).toThrow(ZodError);
        });

        it('should require all mandatory fields', () => {
            const incompleteInput = {
                name: 'Test Tag'
                // Missing required fields: slug, color, lifecycleState
            };

            expect(() => TagCreateInputSchema.parse(incompleteInput)).toThrow(ZodError);
        });

        it('should validate optional fields', () => {
            const inputWithOptionals = {
                ...createTagCreateInput(),
                icon: 'custom-icon',
                notes: 'This is a test note for the tag'
            };

            expect(() => TagCreateInputSchema.parse(inputWithOptionals)).not.toThrow();
        });
    });

    describe('TagCreateOutputSchema', () => {
        it('should validate valid create output', () => {
            const validOutput = createValidTag();

            expect(() => TagCreateOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should require all tag fields in output', () => {
            const incompleteOutput = {
                id: 'tag-id',
                name: 'Test Tag'
                // Missing many required fields
            };

            expect(() => TagCreateOutputSchema.parse(incompleteOutput)).toThrow(ZodError);
        });
    });

    describe('TagUpdateInputSchema', () => {
        it('should validate valid update input', () => {
            const validInput = createTagUpdateInput();

            expect(() => TagUpdateInputSchema.parse(validInput)).not.toThrow();
        });

        it('should accept partial updates', () => {
            const partialInput = {
                name: 'Updated Name'
            };

            expect(() => TagUpdateInputSchema.parse(partialInput)).not.toThrow();
        });

        it('should reject invalid field values', () => {
            const invalidInput = {
                name: 'A', // Too short
                color: 'INVALID_COLOR'
            };

            expect(() => TagUpdateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should validate optional fields in updates', () => {
            const updateWithOptionals = {
                icon: 'updated-icon',
                notes: 'Updated notes for the tag'
            };

            expect(() => TagUpdateInputSchema.parse(updateWithOptionals)).not.toThrow();
        });
    });

    describe('TagUpdateOutputSchema', () => {
        it('should validate valid update output', () => {
            const validOutput = createValidTag();

            expect(() => TagUpdateOutputSchema.parse(validOutput)).not.toThrow();
        });
    });

    describe('TagDeleteInputSchema', () => {
        it('should validate valid delete input', () => {
            const validInput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                force: false
            };

            expect(() => TagDeleteInputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject invalid delete input', () => {
            const invalidInput = {
                id: 'invalid-uuid'
            };

            expect(() => TagDeleteInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should default force to false', () => {
            const input = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
            };

            const result = TagDeleteInputSchema.parse(input);
            expect(result.force).toBe(false);
        });
    });

    describe('TagDeleteOutputSchema', () => {
        it('should validate valid delete output', () => {
            const validOutput = {
                success: true,
                deletedAt: new Date()
            };

            expect(() => TagDeleteOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should default success to true', () => {
            const output = {};

            const result = TagDeleteOutputSchema.parse(output);
            expect(result.success).toBe(true);
        });
    });

    describe('TagRestoreInputSchema', () => {
        it('should validate valid restore input', () => {
            const validInput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
            };

            expect(() => TagRestoreInputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject invalid restore input', () => {
            const invalidInput = {
                id: 'not-a-uuid'
            };

            expect(() => TagRestoreInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('TagRestoreOutputSchema', () => {
        it('should validate valid restore output', () => {
            const validOutput = createValidTag();

            expect(() => TagRestoreOutputSchema.parse(validOutput)).not.toThrow();
        });
    });

    describe('Tag-Entity Relationship Schemas', () => {
        describe('TagAddToEntityInputSchema', () => {
            it('should validate valid add to entity input', () => {
                const validInput = {
                    tagId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    entityId: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
                    entityType: 'accommodation'
                };

                expect(() => TagAddToEntityInputSchema.parse(validInput)).not.toThrow();
            });

            it('should reject invalid UUIDs', () => {
                const invalidInput = {
                    tagId: 'invalid-uuid',
                    entityId: 'also-invalid',
                    entityType: 'accommodation'
                };

                expect(() => TagAddToEntityInputSchema.parse(invalidInput)).toThrow(ZodError);
            });

            it('should reject empty entityType', () => {
                const invalidInput = {
                    tagId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    entityId: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
                    entityType: ''
                };

                expect(() => TagAddToEntityInputSchema.parse(invalidInput)).toThrow(ZodError);
            });
        });

        describe('TagAddToEntityOutputSchema', () => {
            it('should validate valid add to entity output', () => {
                const validOutput = {
                    success: true
                };

                expect(() => TagAddToEntityOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should default success to true', () => {
                const output = {};

                const result = TagAddToEntityOutputSchema.parse(output);
                expect(result.success).toBe(true);
            });
        });

        describe('TagRemoveFromEntityInputSchema', () => {
            it('should validate valid remove from entity input', () => {
                const validInput = {
                    tagId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    entityId: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
                    entityType: 'post'
                };

                expect(() => TagRemoveFromEntityInputSchema.parse(validInput)).not.toThrow();
            });

            it('should reject missing required fields', () => {
                const invalidInput = {
                    tagId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
                    // Missing entityId and entityType
                };

                expect(() => TagRemoveFromEntityInputSchema.parse(invalidInput)).toThrow(ZodError);
            });
        });

        describe('TagRemoveFromEntityOutputSchema', () => {
            it('should validate valid remove from entity output', () => {
                const validOutput = {
                    success: true
                };

                expect(() => TagRemoveFromEntityOutputSchema.parse(validOutput)).not.toThrow();
            });
        });

        describe('TagGetForEntityInputSchema', () => {
            it('should validate valid get for entity input', () => {
                const validInput = {
                    entityId: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
                    entityType: 'destination'
                };

                expect(() => TagGetForEntityInputSchema.parse(validInput)).not.toThrow();
            });

            it('should reject invalid entity ID', () => {
                const invalidInput = {
                    entityId: 'not-uuid',
                    entityType: 'destination'
                };

                expect(() => TagGetForEntityInputSchema.parse(invalidInput)).toThrow(ZodError);
            });
        });

        describe('TagGetForEntityOutputSchema', () => {
            it('should validate valid get for entity output', () => {
                const validOutput = {
                    tags: [createValidTag(), createValidTag()]
                };

                expect(() => TagGetForEntityOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should accept empty tags array', () => {
                const validOutput = {
                    tags: []
                };

                expect(() => TagGetForEntityOutputSchema.parse(validOutput)).not.toThrow();
            });
        });

        describe('TagGetEntitiesByTagInputSchema', () => {
            it('should validate valid get entities by tag input', () => {
                const validInput = {
                    tagId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    entityType: 'event'
                };

                expect(() => TagGetEntitiesByTagInputSchema.parse(validInput)).not.toThrow();
            });

            it('should accept input without entityType filter', () => {
                const validInput = {
                    tagId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
                };

                expect(() => TagGetEntitiesByTagInputSchema.parse(validInput)).not.toThrow();
            });

            it('should reject invalid tag ID', () => {
                const invalidInput = {
                    tagId: 'invalid-uuid'
                };

                expect(() => TagGetEntitiesByTagInputSchema.parse(invalidInput)).toThrow(ZodError);
            });
        });

        describe('TagGetEntitiesByTagOutputSchema', () => {
            it('should validate valid get entities by tag output', () => {
                const validOutput = {
                    entities: [
                        {
                            entityId: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
                            entityType: 'accommodation'
                        },
                        {
                            entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                            entityType: 'post'
                        }
                    ]
                };

                expect(() => TagGetEntitiesByTagOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should accept empty entities array', () => {
                const validOutput = {
                    entities: []
                };

                expect(() => TagGetEntitiesByTagOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should reject invalid entity structure', () => {
                const invalidOutput = {
                    entities: [
                        {
                            entityId: 'invalid-uuid',
                            entityType: ''
                        }
                    ]
                };

                expect(() => TagGetEntitiesByTagOutputSchema.parse(invalidOutput)).toThrow(
                    ZodError
                );
            });
        });
    });

    describe('Integration Tests', () => {
        it('should work with realistic tag workflow', () => {
            // Create input
            const createInput = createTagCreateInput();
            expect(() => TagCreateInputSchema.parse(createInput)).not.toThrow();

            // Create output
            const createOutput = createValidTag();
            expect(() => TagCreateOutputSchema.parse(createOutput)).not.toThrow();

            // Update input
            const updateInput = { name: 'Updated Tag Name' };
            expect(() => TagUpdateInputSchema.parse(updateInput)).not.toThrow();

            // Add to entity
            const addToEntityInput = {
                tagId: createOutput.id,
                entityId: 'e47ac10b-58cc-4372-a567-0e02b2c3d479',
                entityType: 'accommodation'
            };
            expect(() => TagAddToEntityInputSchema.parse(addToEntityInput)).not.toThrow();

            // Get entities by tag
            const getEntitiesInput = { tagId: createOutput.id };
            expect(() => TagGetEntitiesByTagInputSchema.parse(getEntitiesInput)).not.toThrow();
        });
    });
});

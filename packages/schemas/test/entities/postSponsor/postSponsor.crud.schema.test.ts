import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    PostSponsorCountOutputSchema,
    PostSponsorCreateInputSchema,
    PostSponsorCreateOutputSchema,
    PostSponsorDeleteInputSchema,
    PostSponsorDeleteOutputSchema,
    PostSponsorListOutputSchema,
    PostSponsorRestoreInputSchema,
    PostSponsorRestoreOutputSchema,
    PostSponsorSearchInputSchema,
    PostSponsorSearchOutputSchema,
    PostSponsorUpdateInputSchema,
    PostSponsorUpdateOutputSchema,
    PostSponsorViewOutputSchema
} from '../../../src/entities/postSponsor/postSponsor.crud.schema.js';
import { createBasePaginationParams } from '../../fixtures/common.fixtures.js';
import {
    createPostSponsorCreateInput,
    createPostSponsorSearchFilters,
    createPostSponsorUpdateInput,
    createValidPostSponsor
} from '../../fixtures/postSponsor.fixtures.js';

describe('PostSponsor CRUD Schemas', () => {
    describe('PostSponsorCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const validInput = createPostSponsorCreateInput();

            expect(() => PostSponsorCreateInputSchema.parse(validInput)).not.toThrow();

            const result = PostSponsorCreateInputSchema.parse(validInput);
            expect(result.name).toBeDefined();
            expect(result.type).toBeDefined();
            expect(result.description).toBeDefined();
        });

        it('should reject create input with auto-generated fields', () => {
            const invalidInput = {
                ...createPostSponsorCreateInput(),
                id: 'should-not-be-here',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: 'some-user-id'
            };

            expect(() => PostSponsorCreateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should require all mandatory fields', () => {
            const incompleteInput = {
                name: 'Test Sponsor'
                // Missing type and description
            };

            expect(() => PostSponsorCreateInputSchema.parse(incompleteInput)).toThrow(ZodError);
        });
    });

    describe('PostSponsorCreateOutputSchema', () => {
        it('should validate valid create output', () => {
            const validOutput = {
                item: createValidPostSponsor()
            };

            expect(() => PostSponsorCreateOutputSchema.parse(validOutput)).not.toThrow();

            const result = PostSponsorCreateOutputSchema.parse(validOutput);
            expect(result.item).toBeDefined();
            expect(result.item.id).toBeDefined();
        });

        it('should reject output without item wrapper', () => {
            const invalidOutput = createValidPostSponsor();

            expect(() => PostSponsorCreateOutputSchema.parse(invalidOutput)).toThrow(ZodError);
        });
    });

    describe('PostSponsorUpdateInputSchema', () => {
        it('should validate valid update input', () => {
            const validInput = createPostSponsorUpdateInput();

            expect(() => PostSponsorUpdateInputSchema.parse(validInput)).not.toThrow();
        });

        it('should accept partial updates', () => {
            const partialInputs = [
                { name: 'Updated Name' },
                { description: 'Updated description with enough characters' },
                { type: 'HOST' },
                { logo: { url: 'https://example.com/new-logo.jpg' } },
                {} // Empty update should be valid
            ];

            for (const input of partialInputs) {
                expect(() => PostSponsorUpdateInputSchema.parse(input)).not.toThrow();
            }
        });

        it('should reject invalid field values', () => {
            const invalidInputs = [
                { name: 'AB' }, // Too short
                { description: 'Short' }, // Too short
                { type: 'INVALID_TYPE' },
                { logo: { url: 'invalid-url' } }
            ];

            for (const input of invalidInputs) {
                expect(() => PostSponsorUpdateInputSchema.parse(input)).toThrow(ZodError);
            }
        });
    });

    describe('PostSponsorUpdateOutputSchema', () => {
        it('should validate valid update output', () => {
            const validOutput = {
                item: createValidPostSponsor()
            };

            expect(() => PostSponsorUpdateOutputSchema.parse(validOutput)).not.toThrow();
        });
    });

    describe('PostSponsorSearchInputSchema', () => {
        it('should validate valid search input', () => {
            const validInputs = [
                {
                    ...createBasePaginationParams(),
                    ...createPostSponsorSearchFilters()
                },
                {
                    name: 'Test Company',
                    type: 'POST_SPONSOR',
                    q: 'search term'
                },
                {
                    page: 1,
                    pageSize: 20
                },
                {} // Empty search should be valid
            ];

            for (const input of validInputs) {
                expect(() => PostSponsorSearchInputSchema.parse(input)).not.toThrow();
            }
        });

        it('should accept individual filter fields', () => {
            const filterTests = [
                { name: 'Company Name' },
                { type: 'ADVERTISER' },
                { q: 'search query' },
                { name: 'Test', type: 'POST_SPONSOR', q: 'query' }
            ];

            for (const test of filterTests) {
                expect(() => PostSponsorSearchInputSchema.parse(test)).not.toThrow();
            }
        });

        it('should reject invalid filter values', () => {
            const invalidInputs = [
                { name: '' }, // Empty name
                { type: 'INVALID_TYPE' },
                { name: 123 }, // Wrong type
                { page: 0 } // Invalid page
            ];

            for (const input of invalidInputs) {
                expect(() => PostSponsorSearchInputSchema.parse(input)).toThrow(ZodError);
            }
        });
    });

    describe('PostSponsorSearchOutputSchema', () => {
        it('should validate valid search output', () => {
            const validOutput = {
                items: [createValidPostSponsor(), createValidPostSponsor()],
                total: 2
            };

            expect(() => PostSponsorSearchOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should accept empty results', () => {
            const emptyOutput = {
                items: [],
                total: 0
            };

            expect(() => PostSponsorSearchOutputSchema.parse(emptyOutput)).not.toThrow();
        });

        it('should reject invalid output structure', () => {
            const invalidOutputs = [
                {
                    items: 'not-an-array' as any,
                    total: 0
                },
                {
                    items: [],
                    total: -1 // Invalid negative total
                }
            ];

            for (const output of invalidOutputs) {
                expect(() => PostSponsorSearchOutputSchema.parse(output)).toThrow(ZodError);
            }
        });
    });

    describe('PostSponsorListOutputSchema', () => {
        it('should validate valid list output', () => {
            const validOutput = {
                items: [createValidPostSponsor()],
                total: 1
            };

            expect(() => PostSponsorListOutputSchema.parse(validOutput)).not.toThrow();
        });
    });

    describe('PostSponsorDeleteInputSchema', () => {
        it('should validate valid delete input', () => {
            const validInputs = [
                { id: '123e4567-e89b-12d3-a456-426614174000' },
                { id: '123e4567-e89b-12d3-a456-426614174000', force: true },
                { id: '123e4567-e89b-12d3-a456-426614174000', force: false }
            ];

            for (const input of validInputs) {
                expect(() => PostSponsorDeleteInputSchema.parse(input)).not.toThrow();
            }
        });

        it('should reject invalid delete input', () => {
            const invalidInputs = [
                {}, // Missing id
                { id: 'invalid-uuid' },
                { id: '123e4567-e89b-12d3-a456-426614174000', force: 'not-boolean' }
            ];

            for (const input of invalidInputs) {
                expect(() => PostSponsorDeleteInputSchema.parse(input)).toThrow(ZodError);
            }
        });

        it('should default force to false', () => {
            const input = { id: '123e4567-e89b-12d3-a456-426614174000' };
            const result = PostSponsorDeleteInputSchema.parse(input);
            expect(result.force).toBe(false);
        });
    });

    describe('PostSponsorDeleteOutputSchema', () => {
        it('should validate valid delete output', () => {
            const validOutputs = [
                { success: true },
                { success: true, deletedAt: new Date() },
                { success: false }
            ];

            for (const output of validOutputs) {
                expect(() => PostSponsorDeleteOutputSchema.parse(output)).not.toThrow();
            }
        });

        it('should default success to true', () => {
            const output = {};
            const result = PostSponsorDeleteOutputSchema.parse(output);
            expect(result.success).toBe(true);
        });
    });

    describe('PostSponsorRestoreInputSchema', () => {
        it('should validate valid restore input', () => {
            const validInput = { id: '123e4567-e89b-12d3-a456-426614174000' };

            expect(() => PostSponsorRestoreInputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject invalid restore input', () => {
            const invalidInputs = [
                {}, // Missing id
                { id: 'invalid-uuid' },
                { id: '' }
            ];

            for (const input of invalidInputs) {
                expect(() => PostSponsorRestoreInputSchema.parse(input)).toThrow(ZodError);
            }
        });
    });

    describe('PostSponsorRestoreOutputSchema', () => {
        it('should validate valid restore output', () => {
            const validOutput = {
                item: createValidPostSponsor()
            };

            expect(() => PostSponsorRestoreOutputSchema.parse(validOutput)).not.toThrow();
        });
    });

    describe('PostSponsorViewOutputSchema', () => {
        it('should validate valid view output', () => {
            const validOutputs = [
                { item: createValidPostSponsor() },
                { item: null } // Not found case
            ];

            for (const output of validOutputs) {
                expect(() => PostSponsorViewOutputSchema.parse(output)).not.toThrow();
            }
        });
    });

    describe('PostSponsorCountOutputSchema', () => {
        it('should validate valid count output', () => {
            const validOutputs = [{ count: 0 }, { count: 1 }, { count: 100 }];

            for (const output of validOutputs) {
                expect(() => PostSponsorCountOutputSchema.parse(output)).not.toThrow();
            }
        });

        it('should reject invalid count output', () => {
            const invalidOutputs = [
                {}, // Missing count
                { count: -1 }, // Negative count
                { count: 'not-a-number' },
                { count: 1.5 } // Non-integer
            ];

            for (const output of invalidOutputs) {
                expect(() => PostSponsorCountOutputSchema.parse(output)).toThrow(ZodError);
            }
        });
    });
});

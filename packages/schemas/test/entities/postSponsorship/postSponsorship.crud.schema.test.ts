import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    PostSponsorshipCountOutputSchema,
    PostSponsorshipCreateInputSchema,
    PostSponsorshipCreateOutputSchema,
    PostSponsorshipDeleteInputSchema,
    PostSponsorshipDeleteOutputSchema,
    PostSponsorshipRestoreInputSchema,
    PostSponsorshipRestoreOutputSchema,
    PostSponsorshipSearchInputSchema,
    PostSponsorshipSearchOutputSchema,
    PostSponsorshipUpdateInputSchema,
    PostSponsorshipUpdateOutputSchema,
    PostSponsorshipViewOutputSchema
} from '../../../src/entities/postSponsorship/postSponsorship.crud.schema.js';
import { createBasePaginationParams } from '../../fixtures/common.fixtures.js';
import {
    createPostSponsorshipCreateInput,
    createPostSponsorshipSearchParams,
    createPostSponsorshipUpdateInput,
    createValidPostSponsorship
} from '../../fixtures/postSponsorship.fixtures.js';

describe('PostSponsorship CRUD Schemas', () => {
    describe('PostSponsorshipCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const validInput = createPostSponsorshipCreateInput();

            expect(() => PostSponsorshipCreateInputSchema.parse(validInput)).not.toThrow();

            const result = PostSponsorshipCreateInputSchema.parse(validInput);
            expect(result.sponsorId).toBeDefined();
            expect(result.postId).toBeDefined();
            expect(result.description).toBeDefined();
            expect(result.paid).toBeDefined();
        });

        it('should reject create input with auto-generated fields', () => {
            const invalidInput = {
                ...createPostSponsorshipCreateInput(),
                id: 'should-not-be-here',
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: 'some-user-id'
            };

            expect(() => PostSponsorshipCreateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should require all mandatory fields', () => {
            const incompleteInputs = [
                {
                    sponsorId: '123e4567-e89b-12d3-a456-426614174000'
                    // Missing postId, description, paid
                },
                {
                    sponsorId: '123e4567-e89b-12d3-a456-426614174000',
                    postId: '123e4567-e89b-12d3-a456-426614174001'
                    // Missing description, paid
                },
                {
                    sponsorId: '123e4567-e89b-12d3-a456-426614174000',
                    postId: '123e4567-e89b-12d3-a456-426614174001',
                    description: 'Valid description'
                    // Missing paid
                }
            ];

            for (const input of incompleteInputs) {
                expect(() => PostSponsorshipCreateInputSchema.parse(input)).toThrow(ZodError);
            }
        });
    });

    describe('PostSponsorshipCreateOutputSchema', () => {
        it('should validate valid create output', () => {
            const validOutput = {
                item: createValidPostSponsorship()
            };

            expect(() => PostSponsorshipCreateOutputSchema.parse(validOutput)).not.toThrow();

            const result = PostSponsorshipCreateOutputSchema.parse(validOutput);
            expect(result.item).toBeDefined();
            expect(result.item.id).toBeDefined();
        });

        it('should reject output without item wrapper', () => {
            const invalidOutput = createValidPostSponsorship();

            expect(() => PostSponsorshipCreateOutputSchema.parse(invalidOutput)).toThrow(ZodError);
        });
    });

    describe('PostSponsorshipUpdateInputSchema', () => {
        it('should validate valid update input', () => {
            const validInput = createPostSponsorshipUpdateInput();

            expect(() => PostSponsorshipUpdateInputSchema.parse(validInput)).not.toThrow();
        });

        it('should accept partial updates', () => {
            const partialInputs = [
                { message: 'Updated message' },
                { description: 'Updated description with enough characters' },
                { paid: { price: 500.0, currency: 'USD' } },
                { isHighlighted: true },
                { paidAt: new Date() },
                { fromDate: new Date() },
                { toDate: new Date() },
                {} // Empty update should be valid
            ];

            for (const input of partialInputs) {
                expect(() => PostSponsorshipUpdateInputSchema.parse(input)).not.toThrow();
            }
        });

        it('should reject invalid field values', () => {
            const invalidInputs = [
                { message: 'Hi' }, // Too short
                { description: 'Short' }, // Too short
                { paid: { price: -100, currency: 'USD' } }, // Negative price
                { paid: { price: 100, currency: 'INVALID' } }, // Invalid currency
                { sponsorId: 'invalid-uuid' },
                { postId: 'invalid-uuid' }
            ];

            for (const input of invalidInputs) {
                expect(() => PostSponsorshipUpdateInputSchema.parse(input)).toThrow(ZodError);
            }
        });
    });

    describe('PostSponsorshipUpdateOutputSchema', () => {
        it('should validate valid update output', () => {
            const validOutput = {
                item: createValidPostSponsorship()
            };

            expect(() => PostSponsorshipUpdateOutputSchema.parse(validOutput)).not.toThrow();
        });
    });

    describe('PostSponsorshipSearchInputSchema', () => {
        it('should validate valid search input', () => {
            const validInputs = [
                {
                    ...createPostSponsorshipSearchParams(),
                    pagination: createBasePaginationParams()
                },
                {
                    sponsorId: '123e4567-e89b-12d3-a456-426614174000',
                    postId: '123e4567-e89b-12d3-a456-426614174001'
                },
                {
                    fromDate: new Date().toISOString(),
                    toDate: new Date().toISOString(),
                    isHighlighted: true
                },
                {
                    pagination: { page: 1, pageSize: 20 }
                },
                {} // Empty search should be valid
            ];

            for (const input of validInputs) {
                expect(() => PostSponsorshipSearchInputSchema.parse(input)).not.toThrow();
            }
        });

        it('should accept individual search parameters', () => {
            const paramTests = [
                { sponsorId: '123e4567-e89b-12d3-a456-426614174000' },
                { postId: '123e4567-e89b-12d3-a456-426614174001' },
                { fromDate: '2024-01-01T00:00:00.000Z' },
                { toDate: '2024-12-31T23:59:59.999Z' },
                { isHighlighted: true },
                { isHighlighted: false }
            ];

            for (const test of paramTests) {
                expect(() => PostSponsorshipSearchInputSchema.parse(test)).not.toThrow();
            }
        });

        it('should reject invalid search parameters', () => {
            const invalidInputs = [
                { sponsorId: 'invalid-uuid' },
                { postId: 'invalid-uuid' },
                { isHighlighted: 'not-boolean' },
                { pagination: { page: 0 } }, // Invalid page
                { pagination: { pageSize: 0 } } // Invalid pageSize
            ];

            for (const input of invalidInputs) {
                expect(() => PostSponsorshipSearchInputSchema.parse(input)).toThrow(ZodError);
            }
        });
    });

    describe('PostSponsorshipSearchOutputSchema', () => {
        it('should validate valid search output', () => {
            const validOutput = {
                items: [createValidPostSponsorship(), createValidPostSponsorship()],
                total: 2
            };

            expect(() => PostSponsorshipSearchOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should accept empty results', () => {
            const emptyOutput = {
                items: [],
                total: 0
            };

            expect(() => PostSponsorshipSearchOutputSchema.parse(emptyOutput)).not.toThrow();
        });

        it('should reject invalid output structure', () => {
            const invalidOutputs = [
                { items: [createValidPostSponsorship()] }, // Missing total
                { total: 5 }, // Missing items
                { items: 'not-an-array', total: 0 },
                { items: [], total: -1 } // Negative total
            ];

            for (const output of invalidOutputs) {
                expect(() => PostSponsorshipSearchOutputSchema.parse(output)).toThrow(ZodError);
            }
        });
    });

    describe('PostSponsorshipDeleteInputSchema', () => {
        it('should validate valid delete input', () => {
            const validInputs = [
                { id: '123e4567-e89b-12d3-a456-426614174000' },
                { id: '123e4567-e89b-12d3-a456-426614174000', force: true },
                { id: '123e4567-e89b-12d3-a456-426614174000', force: false }
            ];

            for (const input of validInputs) {
                expect(() => PostSponsorshipDeleteInputSchema.parse(input)).not.toThrow();
            }
        });

        it('should reject invalid delete input', () => {
            const invalidInputs = [
                {}, // Missing id
                { id: 'invalid-uuid' },
                { id: '123e4567-e89b-12d3-a456-426614174000', force: 'not-boolean' }
            ];

            for (const input of invalidInputs) {
                expect(() => PostSponsorshipDeleteInputSchema.parse(input)).toThrow(ZodError);
            }
        });

        it('should default force to false', () => {
            const input = { id: '123e4567-e89b-12d3-a456-426614174000' };
            const result = PostSponsorshipDeleteInputSchema.parse(input);
            expect(result.force).toBe(false);
        });
    });

    describe('PostSponsorshipDeleteOutputSchema', () => {
        it('should validate valid delete output', () => {
            const validOutputs = [
                { success: true },
                { success: true, deletedAt: new Date() },
                { success: false }
            ];

            for (const output of validOutputs) {
                expect(() => PostSponsorshipDeleteOutputSchema.parse(output)).not.toThrow();
            }
        });

        it('should default success to true', () => {
            const output = {};
            const result = PostSponsorshipDeleteOutputSchema.parse(output);
            expect(result.success).toBe(true);
        });
    });

    describe('PostSponsorshipRestoreInputSchema', () => {
        it('should validate valid restore input', () => {
            const validInput = { id: '123e4567-e89b-12d3-a456-426614174000' };

            expect(() => PostSponsorshipRestoreInputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject invalid restore input', () => {
            const invalidInputs = [
                {}, // Missing id
                { id: 'invalid-uuid' },
                { id: '' }
            ];

            for (const input of invalidInputs) {
                expect(() => PostSponsorshipRestoreInputSchema.parse(input)).toThrow(ZodError);
            }
        });
    });

    describe('PostSponsorshipRestoreOutputSchema', () => {
        it('should validate valid restore output', () => {
            const validOutput = {
                item: createValidPostSponsorship()
            };

            expect(() => PostSponsorshipRestoreOutputSchema.parse(validOutput)).not.toThrow();
        });
    });

    describe('PostSponsorshipViewOutputSchema', () => {
        it('should validate valid view output', () => {
            const validOutputs = [
                { item: createValidPostSponsorship() },
                { item: null } // Not found case
            ];

            for (const output of validOutputs) {
                expect(() => PostSponsorshipViewOutputSchema.parse(output)).not.toThrow();
            }
        });
    });

    describe('PostSponsorshipCountOutputSchema', () => {
        it('should validate valid count output', () => {
            const validOutputs = [{ count: 0 }, { count: 1 }, { count: 100 }];

            for (const output of validOutputs) {
                expect(() => PostSponsorshipCountOutputSchema.parse(output)).not.toThrow();
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
                expect(() => PostSponsorshipCountOutputSchema.parse(output)).toThrow(ZodError);
            }
        });
    });

    describe('Integration Tests', () => {
        it('should work with realistic sponsorship workflow', () => {
            // Create input
            const createInput = createPostSponsorshipCreateInput();
            expect(() => PostSponsorshipCreateInputSchema.parse(createInput)).not.toThrow();

            // Create output
            const sponsorship = createValidPostSponsorship();
            const createOutput = { item: sponsorship };
            expect(() => PostSponsorshipCreateOutputSchema.parse(createOutput)).not.toThrow();

            // Update input
            const updateInput = {
                message: 'Updated sponsorship message',
                isHighlighted: true,
                paidAt: new Date()
            };
            expect(() => PostSponsorshipUpdateInputSchema.parse(updateInput)).not.toThrow();

            // Search input
            const searchInput = {
                sponsorId: sponsorship.sponsorId,
                isHighlighted: true,
                pagination: { page: 1, pageSize: 10 }
            };
            expect(() => PostSponsorshipSearchInputSchema.parse(searchInput)).not.toThrow();

            // Search output
            const searchOutput = {
                items: [sponsorship],
                total: 1
            };
            expect(() => PostSponsorshipSearchOutputSchema.parse(searchOutput)).not.toThrow();
        });
    });
});

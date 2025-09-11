import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    DestinationCreateInputSchema,
    DestinationCreateOutputSchema,
    DestinationDeleteInputSchema,
    DestinationDeleteOutputSchema,
    DestinationRestoreInputSchema,
    DestinationRestoreOutputSchema,
    DestinationUpdateInputSchema,
    DestinationUpdateOutputSchema
} from '../../../src/entities/destination/destination.crud.schema.js';
import { createValidDestination } from '../../fixtures/destination.fixtures.js';

describe('Destination CRUD Schemas', () => {
    describe('DestinationCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const destination = createValidDestination();
            const createInput = {
                slug: destination.slug,
                name: destination.name,
                summary: destination.summary,
                description: destination.description,
                isFeatured: destination.isFeatured,
                moderationState: destination.moderationState,
                visibility: destination.visibility,
                location: destination.location,
                accommodationsCount: destination.accommodationsCount
            };
            expect(() => DestinationCreateInputSchema.parse(createInput)).not.toThrow();
        });

        it('should reject create input with auto-generated fields', () => {
            const destination = createValidDestination();
            const createInput = {
                id: destination.id, // Should be omitted
                slug: destination.slug,
                name: destination.name,
                summary: destination.summary,
                description: destination.description,
                createdAt: new Date() // Should be omitted
            };
            expect(() => DestinationCreateInputSchema.parse(createInput)).toThrow(ZodError);
        });

        it('should validate minimal create input', () => {
            const destination = createValidDestination();
            const createInput = {
                slug: destination.slug,
                name: destination.name,
                summary: destination.summary,
                description: destination.description,
                moderationState: destination.moderationState,
                visibility: destination.visibility,
                location: destination.location
            };
            expect(() => DestinationCreateInputSchema.parse(createInput)).not.toThrow();
        });
    });

    describe('DestinationCreateOutputSchema', () => {
        it('should validate complete destination output', () => {
            const destination = createValidDestination();
            expect(() => DestinationCreateOutputSchema.parse(destination)).not.toThrow();
        });
    });

    describe('DestinationUpdateInputSchema', () => {
        it('should validate partial update input', () => {
            const updateInput = {
                name: faker.location.city(),
                summary: faker.lorem.paragraph().slice(0, 300)
            };
            expect(() => DestinationUpdateInputSchema.parse(updateInput)).not.toThrow();
        });

        it('should validate empty update input', () => {
            const updateInput = {};
            expect(() => DestinationUpdateInputSchema.parse(updateInput)).not.toThrow();
        });

        it('should reject update input with auto-generated fields', () => {
            const updateInput = {
                id: faker.string.uuid(), // Should be omitted
                name: faker.location.city(),
                createdAt: new Date() // Should be omitted
            };
            expect(() => DestinationUpdateInputSchema.parse(updateInput)).toThrow(ZodError);
        });

        it('should validate update with all optional fields', () => {
            const destination = createValidDestination();
            const updateInput = {
                slug: destination.slug,
                name: destination.name,
                summary: destination.summary,
                description: destination.description,
                isFeatured: !destination.isFeatured,
                location: destination.location,
                media: destination.media,
                accommodationsCount: destination.accommodationsCount + 1
            };
            expect(() => DestinationUpdateInputSchema.parse(updateInput)).not.toThrow();
        });
    });

    describe('DestinationUpdateOutputSchema', () => {
        it('should validate complete destination output', () => {
            const destination = createValidDestination();
            expect(() => DestinationUpdateOutputSchema.parse(destination)).not.toThrow();
        });
    });

    describe('DestinationDeleteInputSchema', () => {
        it('should validate delete input with id only', () => {
            const deleteInput = {
                id: faker.string.uuid()
            };
            expect(() => DestinationDeleteInputSchema.parse(deleteInput)).not.toThrow();
        });

        it('should validate delete input with force flag', () => {
            const deleteInput = {
                id: faker.string.uuid(),
                force: true
            };
            expect(() => DestinationDeleteInputSchema.parse(deleteInput)).not.toThrow();
        });

        it('should apply default force value', () => {
            const deleteInput = {
                id: faker.string.uuid()
            };
            const result = DestinationDeleteInputSchema.parse(deleteInput);
            expect(result.force).toBe(false);
        });

        it('should reject invalid id format', () => {
            const deleteInput = {
                id: 'invalid-uuid'
            };
            expect(() => DestinationDeleteInputSchema.parse(deleteInput)).toThrow(ZodError);
        });

        it('should reject missing id', () => {
            const deleteInput = {
                force: true
            };
            expect(() => DestinationDeleteInputSchema.parse(deleteInput)).toThrow(ZodError);
        });
    });

    describe('DestinationDeleteOutputSchema', () => {
        it('should validate delete output with success', () => {
            const deleteOutput = {
                success: true,
                deletedAt: new Date()
            };
            expect(() => DestinationDeleteOutputSchema.parse(deleteOutput)).not.toThrow();
        });

        it('should validate delete output without deletedAt', () => {
            const deleteOutput = {
                success: true
            };
            expect(() => DestinationDeleteOutputSchema.parse(deleteOutput)).not.toThrow();
        });

        it('should apply default success value', () => {
            const deleteOutput = {};
            const result = DestinationDeleteOutputSchema.parse(deleteOutput);
            expect(result.success).toBe(true);
        });
    });

    describe('DestinationRestoreInputSchema', () => {
        it('should validate restore input', () => {
            const restoreInput = {
                id: faker.string.uuid()
            };
            expect(() => DestinationRestoreInputSchema.parse(restoreInput)).not.toThrow();
        });

        it('should reject invalid id format', () => {
            const restoreInput = {
                id: 'invalid-uuid'
            };
            expect(() => DestinationRestoreInputSchema.parse(restoreInput)).toThrow(ZodError);
        });

        it('should reject missing id', () => {
            const restoreInput = {};
            expect(() => DestinationRestoreInputSchema.parse(restoreInput)).toThrow(ZodError);
        });
    });

    describe('DestinationRestoreOutputSchema', () => {
        it('should validate complete destination output', () => {
            const destination = createValidDestination();
            expect(() => DestinationRestoreOutputSchema.parse(destination)).not.toThrow();
        });
    });
});

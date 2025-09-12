import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    FeatureCreateInputSchema,
    FeatureCreateOutputSchema,
    FeatureDeleteInputSchema,
    FeatureDeleteOutputSchema,
    FeaturePatchInputSchema,
    FeatureRestoreInputSchema,
    FeatureRestoreOutputSchema,
    FeatureUpdateInputSchema,
    FeatureUpdateOutputSchema
} from '../../../src/entities/feature/feature.crud.schema.js';
import {
    createMinimalFeatureCreateInput,
    createPartialFeatureUpdateInput,
    createValidFeature,
    createValidFeatureCreateInput,
    createValidFeatureUpdateInput
} from '../../fixtures/feature.fixtures.js';

describe('Feature CRUD Schemas', () => {
    describe('FeatureCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const validInput = createValidFeatureCreateInput();

            expect(() => FeatureCreateInputSchema.parse(validInput)).not.toThrow();

            const result = FeatureCreateInputSchema.parse(validInput);
            expect(result.slug).toBeDefined();
            expect(result.name).toBeDefined();
            expect('id' in result).toBe(false); // Should be omitted
            expect('createdAt' in result).toBe(false); // Should be omitted
        });

        it('should reject create input with auto-generated fields', () => {
            const validData = createValidFeature();

            // Should reject with id field
            expect(() => FeatureCreateInputSchema.parse(validData)).toThrow(ZodError);
        });

        it('should validate minimal create input', () => {
            const minimalInput = createMinimalFeatureCreateInput();

            expect(() => FeatureCreateInputSchema.parse(minimalInput)).not.toThrow();

            const result = FeatureCreateInputSchema.parse(minimalInput);
            expect(result.slug).toBeDefined();
            expect(result.name).toBeDefined();
        });

        it('should reject create input with invalid slug', () => {
            const invalidInput = {
                slug: 'ab', // Too short
                name: faker.lorem.words(2),
                lifecycleState: 'ACTIVE'
            };

            expect(() => FeatureCreateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject create input with invalid name', () => {
            const invalidInput = {
                slug: faker.lorem.slug(3),
                name: 'A', // Too short
                lifecycleState: 'ACTIVE'
            };

            expect(() => FeatureCreateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject create input with invalid lifecycle state', () => {
            const invalidInput = {
                slug: faker.lorem.slug(3),
                name: faker.lorem.words(2),
                lifecycleState: 'INVALID_STATE'
            };

            expect(() => FeatureCreateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('FeatureCreateOutputSchema', () => {
        it('should validate create output', () => {
            const createOutput = createValidFeature();

            expect(() => FeatureCreateOutputSchema.parse(createOutput)).not.toThrow();

            const result = FeatureCreateOutputSchema.parse(createOutput);
            expect(result.id).toBeDefined();
            expect(result.slug).toBeDefined();
            expect(result.name).toBeDefined();
            expect(result.createdAt).toBeDefined();
            expect(result.updatedAt).toBeDefined();
        });
    });

    describe('FeatureUpdateInputSchema', () => {
        it('should validate valid update input', () => {
            const updateInput = createValidFeatureUpdateInput();

            expect(() => FeatureUpdateInputSchema.parse(updateInput)).not.toThrow();

            const result = FeatureUpdateInputSchema.parse(updateInput);
            expect(result.name).toBeDefined();
        });

        it('should validate empty update input', () => {
            const emptyUpdate = {};

            expect(() => FeatureUpdateInputSchema.parse(emptyUpdate)).not.toThrow();
        });

        it('should validate partial update input', () => {
            const partialUpdate = createPartialFeatureUpdateInput();

            expect(() => FeatureUpdateInputSchema.parse(partialUpdate)).not.toThrow();

            const result = FeatureUpdateInputSchema.parse(partialUpdate);
            expect(result.name).toBeDefined();
        });

        it('should reject update input with auto-generated fields', () => {
            const updateData = {
                name: faker.lorem.words(2),
                id: faker.string.uuid(),
                createdAt: new Date()
            };

            expect(() => FeatureUpdateInputSchema.parse(updateData)).toThrow(ZodError);
        });

        it('should reject update input with invalid name', () => {
            const invalidUpdate = {
                name: 'A' // Too short
            };

            expect(() => FeatureUpdateInputSchema.parse(invalidUpdate)).toThrow(ZodError);
        });

        it('should reject update input with invalid slug', () => {
            const invalidUpdate = {
                slug: 'ab' // Too short
            };

            expect(() => FeatureUpdateInputSchema.parse(invalidUpdate)).toThrow(ZodError);
        });
    });

    describe('FeaturePatchInputSchema', () => {
        it('should validate patch input', () => {
            const patchInput = {
                name: faker.lorem.words(2)
            };

            expect(() => FeaturePatchInputSchema.parse(patchInput)).not.toThrow();
        });

        it('should validate empty patch input', () => {
            const emptyPatch = {};

            expect(() => FeaturePatchInputSchema.parse(emptyPatch)).not.toThrow();
        });

        it('should reject patch input with auto-generated fields', () => {
            const patchData = {
                name: faker.lorem.words(2),
                id: faker.string.uuid()
            };

            expect(() => FeaturePatchInputSchema.parse(patchData)).toThrow(ZodError);
        });
    });

    describe('FeatureUpdateOutputSchema', () => {
        it('should validate update output', () => {
            const updateOutput = createValidFeature();

            expect(() => FeatureUpdateOutputSchema.parse(updateOutput)).not.toThrow();

            const result = FeatureUpdateOutputSchema.parse(updateOutput);
            expect(result.id).toBeDefined();
            expect(result.updatedAt).toBeDefined();
        });
    });

    describe('FeatureDeleteInputSchema', () => {
        it('should validate delete input with ID only', () => {
            const deleteData = {
                id: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => FeatureDeleteInputSchema.parse(deleteData)).not.toThrow();

            const result = FeatureDeleteInputSchema.parse(deleteData);
            expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(result.force).toBe(false); // Default value
        });

        it('should validate delete input with force flag', () => {
            const deleteData = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                force: true
            };

            expect(() => FeatureDeleteInputSchema.parse(deleteData)).not.toThrow();

            const result = FeatureDeleteInputSchema.parse(deleteData);
            expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(result.force).toBe(true);
        });

        it('should reject delete input without ID', () => {
            const deleteData = {
                force: true
            };

            expect(() => FeatureDeleteInputSchema.parse(deleteData)).toThrow(ZodError);
        });

        it('should reject delete input with invalid force type', () => {
            const deleteData = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                force: 'invalid'
            };

            expect(() => FeatureDeleteInputSchema.parse(deleteData)).toThrow(ZodError);
        });

        it('should reject delete input with invalid ID format', () => {
            const deleteData = {
                id: 'invalid-uuid'
            };

            expect(() => FeatureDeleteInputSchema.parse(deleteData)).toThrow(ZodError);
        });
    });

    describe('FeatureDeleteOutputSchema', () => {
        it('should validate delete output with success only', () => {
            const deleteOutput = {
                success: true
            };

            expect(() => FeatureDeleteOutputSchema.parse(deleteOutput)).not.toThrow();

            const result = FeatureDeleteOutputSchema.parse(deleteOutput);
            expect(result.success).toBe(true);
        });

        it('should validate delete output with deletedAt', () => {
            const deleteOutput = {
                success: true,
                deletedAt: new Date()
            };

            expect(() => FeatureDeleteOutputSchema.parse(deleteOutput)).not.toThrow();

            const result = FeatureDeleteOutputSchema.parse(deleteOutput);
            expect(result.success).toBe(true);
            expect(result.deletedAt).toBeInstanceOf(Date);
        });

        it('should use default success value', () => {
            const deleteOutput = {};

            expect(() => FeatureDeleteOutputSchema.parse(deleteOutput)).not.toThrow();

            const result = FeatureDeleteOutputSchema.parse(deleteOutput);
            expect(result.success).toBe(true); // Default value
        });
    });

    describe('FeatureRestoreInputSchema', () => {
        it('should validate restore input', () => {
            const restoreData = {
                id: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => FeatureRestoreInputSchema.parse(restoreData)).not.toThrow();

            const result = FeatureRestoreInputSchema.parse(restoreData);
            expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
        });

        it('should reject restore input without ID', () => {
            const restoreData = {};

            expect(() => FeatureRestoreInputSchema.parse(restoreData)).toThrow(ZodError);
        });

        it('should reject restore input with invalid ID format', () => {
            const restoreData = {
                id: 'invalid-uuid'
            };

            expect(() => FeatureRestoreInputSchema.parse(restoreData)).toThrow(ZodError);
        });
    });

    describe('FeatureRestoreOutputSchema', () => {
        it('should validate restore output', () => {
            const restoreOutput = createValidFeature();

            expect(() => FeatureRestoreOutputSchema.parse(restoreOutput)).not.toThrow();

            const result = FeatureRestoreOutputSchema.parse(restoreOutput);
            expect(result.id).toBeDefined();
            expect(result.slug).toBeDefined();
            expect(result.name).toBeDefined();
        });
    });
});

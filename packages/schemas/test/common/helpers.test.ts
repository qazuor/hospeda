import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    NewEntityInputSchema,
    PartialEntitySchema,
    WithAdminInfoSchema,
    WithAuditSchema,
    WithLifecycleStateSchema,
    WithModerationStateSchema,
    WithReviewStateSchema,
    WithSeoSchema,
    WithVisibilitySchema
} from '../../src/common/helpers.schema.js';

describe('Helper Schemas', () => {
    describe('NewEntityInputSchema', () => {
        it('should omit system fields from base schema', () => {
            // Create a test schema with system fields
            const TestSchema = z.object({
                id: z.string(),
                name: z.string(),
                description: z.string(),
                createdAt: z.date(),
                updatedAt: z.date(),
                createdById: z.string(),
                updatedById: z.string(),
                deletedAt: z.date().optional(),
                deletedById: z.string().optional()
            });

            const NewTestInputSchema = NewEntityInputSchema(TestSchema);

            // Should accept data without system fields
            const validInput = {
                name: 'Test Name',
                description: 'Test Description'
            };

            expect(() => NewTestInputSchema.parse(validInput)).not.toThrow();

            const result = NewTestInputSchema.parse(validInput);
            expect(result.name).toBe('Test Name');
            expect(result.description).toBe('Test Description');
        });

        it('should only accept non-system fields', () => {
            const TestSchema = z.object({
                id: z.string(),
                name: z.string(),
                createdAt: z.date(),
                updatedAt: z.date(),
                createdById: z.string(),
                updatedById: z.string(),
                deletedAt: z.date().optional(),
                deletedById: z.string().optional()
            });

            const NewTestInputSchema = NewEntityInputSchema(TestSchema);

            // Should only accept the non-system fields
            const validInput = {
                name: 'Test Name'
            };

            expect(() => NewTestInputSchema.parse(validInput)).not.toThrow();
            const result = NewTestInputSchema.parse(validInput);
            expect(result.name).toBe('Test Name');
            expect(result).not.toHaveProperty('id');
            expect(result).not.toHaveProperty('createdAt');
        });
    });

    describe('PartialEntitySchema', () => {
        it('should make all fields optional', () => {
            const TestSchema = z.object({
                name: z.string(),
                description: z.string(),
                count: z.number()
            });

            const PartialTestSchema = PartialEntitySchema(TestSchema);

            // Should accept empty object
            expect(() => PartialTestSchema.parse({})).not.toThrow();

            // Should accept partial data
            const partialInput = { name: 'Test Name' };
            expect(() => PartialTestSchema.parse(partialInput)).not.toThrow();

            const result = PartialTestSchema.parse(partialInput);
            expect(result.name).toBe('Test Name');
            expect(result.description).toBeUndefined();
        });
    });

    describe('WithAuditSchema', () => {
        it('should validate audit fields', () => {
            const validInput = {
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '123e4567-e89b-12d3-a456-426614174000',
                updatedById: '123e4567-e89b-12d3-a456-426614174001'
            };

            expect(() => WithAuditSchema.parse(validInput)).not.toThrow();
            const result = WithAuditSchema.parse(validInput);
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.createdById).toBe(validInput.createdById);
        });

        it('should accept optional deletion fields', () => {
            const validInput = {
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '123e4567-e89b-12d3-a456-426614174000',
                updatedById: '123e4567-e89b-12d3-a456-426614174001',
                deletedAt: new Date(),
                deletedById: '123e4567-e89b-12d3-a456-426614174002'
            };

            expect(() => WithAuditSchema.parse(validInput)).not.toThrow();
        });
    });

    describe('WithReviewStateSchema', () => {
        it('should validate review state fields', () => {
            const validInput = {
                reviewsCount: 42,
                averageRating: 4.5
            };

            expect(() => WithReviewStateSchema.parse(validInput)).not.toThrow();
            const result = WithReviewStateSchema.parse(validInput);
            expect(result.reviewsCount).toBe(42);
            expect(result.averageRating).toBe(4.5);
        });

        it('should accept empty object (all fields optional)', () => {
            expect(() => WithReviewStateSchema.parse({})).not.toThrow();
        });

        it('should reject invalid rating values', () => {
            const invalidInput = {
                averageRating: 6 // Should be max 5
            };

            expect(() => WithReviewStateSchema.parse(invalidInput)).toThrow();
        });
    });

    describe('WithModerationStateSchema', () => {
        it('should validate moderation state', () => {
            const validInput = {
                moderationState: 'APPROVED'
            };

            expect(() => WithModerationStateSchema.parse(validInput)).not.toThrow();
        });

        it('should reject invalid moderation states', () => {
            const invalidInput = {
                moderationState: 'INVALID_STATE'
            };

            expect(() => WithModerationStateSchema.parse(invalidInput)).toThrow();
        });
    });

    describe('WithLifecycleStateSchema', () => {
        it('should validate lifecycle state', () => {
            const validInput = {
                lifecycleState: 'ACTIVE'
            };

            expect(() => WithLifecycleStateSchema.parse(validInput)).not.toThrow();
        });

        it('should reject invalid lifecycle states', () => {
            const invalidInput = {
                lifecycleState: 'INVALID_STATE'
            };

            expect(() => WithLifecycleStateSchema.parse(invalidInput)).toThrow();
        });
    });

    describe('WithVisibilitySchema', () => {
        it('should validate visibility state', () => {
            const validInput = {
                visibility: 'PUBLIC'
            };

            expect(() => WithVisibilitySchema.parse(validInput)).not.toThrow();
        });

        it('should reject invalid visibility states', () => {
            const invalidInput = {
                visibility: 'INVALID_VISIBILITY'
            };

            expect(() => WithVisibilitySchema.parse(invalidInput)).toThrow();
        });
    });

    describe('WithAdminInfoSchema', () => {
        it('should validate admin info', () => {
            const validInput = {
                adminInfo: {
                    notes: 'Admin notes',
                    flags: ['FEATURED'],
                    priority: 'HIGH'
                }
            };

            expect(() => WithAdminInfoSchema.parse(validInput)).not.toThrow();
        });

        it('should accept empty object (admin info is optional)', () => {
            expect(() => WithAdminInfoSchema.parse({})).not.toThrow();
        });
    });

    describe('WithSeoSchema', () => {
        it('should validate SEO info', () => {
            const validInput = {
                seo: {
                    title: 'Optimized SEO Title For Search Engines',
                    description:
                        'This is a well-crafted SEO description that provides comprehensive details about the content while staying within limits.'
                }
            };

            expect(() => WithSeoSchema.parse(validInput)).not.toThrow();
        });

        it('should accept empty object (SEO is optional)', () => {
            expect(() => WithSeoSchema.parse({})).not.toThrow();
        });
    });
});

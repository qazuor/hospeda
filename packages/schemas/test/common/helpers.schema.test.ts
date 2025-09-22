import { describe, expect, test } from 'vitest';
import { ZodError, z } from 'zod';
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

describe('Helper Composition Schemas', () => {
    describe('WithAuditSchema', () => {
        test('should validate valid audit fields', () => {
            const validAudit = {
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440000',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            expect(() => WithAuditSchema.parse(validAudit)).not.toThrow();
            const result = WithAuditSchema.parse(validAudit);
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
            expect(result.createdById).toBe(validAudit.createdById);
            expect(result.updatedById).toBe(validAudit.updatedById);
        });

        test('should validate audit fields with optional deleted fields', () => {
            const auditWithDeleted = {
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440000',
                updatedById: '550e8400-e29b-41d4-a716-446655440001',
                deletedAt: new Date(),
                deletedById: '550e8400-e29b-41d4-a716-446655440002'
            };

            expect(() => WithAuditSchema.parse(auditWithDeleted)).not.toThrow();
            const result = WithAuditSchema.parse(auditWithDeleted);
            expect(result.deletedAt).toBeInstanceOf(Date);
            expect(result.deletedById).toBe(auditWithDeleted.deletedById);
        });

        test('should reject invalid UUID in user IDs', () => {
            const invalidAudit = {
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: 'invalid-uuid',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            expect(() => WithAuditSchema.parse(invalidAudit)).toThrow(ZodError);
        });

        test('should reject invalid date types', () => {
            const invalidAudit = {
                createdAt: 'not-a-date',
                updatedAt: new Date(),
                createdById: '550e8400-e29b-41d4-a716-446655440000',
                updatedById: '550e8400-e29b-41d4-a716-446655440001'
            };

            expect(() => WithAuditSchema.parse(invalidAudit)).toThrow(ZodError);
        });
    });

    describe('WithReviewStateSchema', () => {
        test('should validate valid review state', () => {
            const validReviewState = {
                reviewsCount: 10,
                averageRating: 4.5
            };

            expect(() => WithReviewStateSchema.parse(validReviewState)).not.toThrow();
            const result = WithReviewStateSchema.parse(validReviewState);
            expect(result.reviewsCount).toBe(10);
            expect(result.averageRating).toBe(4.5);
        });

        test('should validate empty review state', () => {
            const emptyReviewState = {};

            expect(() => WithReviewStateSchema.parse(emptyReviewState)).not.toThrow();
        });

        test('should validate with only optional fields', () => {
            const partialReviewState = {
                reviewsCount: 5
            };

            expect(() => WithReviewStateSchema.parse(partialReviewState)).not.toThrow();
            const result = WithReviewStateSchema.parse(partialReviewState);
            expect(result.reviewsCount).toBe(5);
            expect(result.averageRating).toBeUndefined();
        });

        test('should reject negative reviews count', () => {
            const invalidReviewState = {
                reviewsCount: -1,
                averageRating: 4.0
            };

            expect(() => WithReviewStateSchema.parse(invalidReviewState)).toThrow(ZodError);
        });

        test('should reject rating outside valid range', () => {
            const invalidReviewState = {
                reviewsCount: 10,
                averageRating: 6.0 // > 5
            };

            expect(() => WithReviewStateSchema.parse(invalidReviewState)).toThrow(ZodError);
        });

        test('should reject non-integer reviews count', () => {
            const invalidReviewState = {
                reviewsCount: 10.5,
                averageRating: 4.0
            };

            expect(() => WithReviewStateSchema.parse(invalidReviewState)).toThrow(ZodError);
        });
    });

    describe('WithModerationStateSchema', () => {
        test('should validate valid moderation states', () => {
            const validStates = ['PENDING', 'APPROVED', 'REJECTED'];

            for (const state of validStates) {
                const data = { moderationState: state };
                expect(() => WithModerationStateSchema.parse(data)).not.toThrow();
            }
        });

        test('should reject invalid moderation state', () => {
            const invalidData = { moderationState: 'invalid-state' };
            expect(() => WithModerationStateSchema.parse(invalidData)).toThrow(ZodError);
        });

        test('should require moderation state field', () => {
            const emptyData = {};
            expect(() => WithModerationStateSchema.parse(emptyData)).toThrow(ZodError);
        });
    });

    describe('WithLifecycleStateSchema', () => {
        test('should validate valid lifecycle states', () => {
            const validStates = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

            for (const state of validStates) {
                const data = { lifecycleState: state };
                expect(() => WithLifecycleStateSchema.parse(data)).not.toThrow();
            }
        });

        test('should reject invalid lifecycle state', () => {
            const invalidData = { lifecycleState: 'invalid-state' };
            expect(() => WithLifecycleStateSchema.parse(invalidData)).toThrow(ZodError);
        });

        test('should require lifecycle state field', () => {
            const emptyData = {};
            expect(() => WithLifecycleStateSchema.parse(emptyData)).toThrow(ZodError);
        });
    });

    describe('WithVisibilitySchema', () => {
        test('should validate valid visibility states', () => {
            const validStates = ['PUBLIC', 'PRIVATE', 'RESTRICTED'];

            for (const state of validStates) {
                const data = { visibility: state };
                expect(() => WithVisibilitySchema.parse(data)).not.toThrow();
            }
        });

        test('should reject invalid visibility state', () => {
            const invalidData = { visibility: 'invalid-state' };
            expect(() => WithVisibilitySchema.parse(invalidData)).toThrow(ZodError);
        });

        test('should require visibility field', () => {
            const emptyData = {};
            expect(() => WithVisibilitySchema.parse(emptyData)).toThrow(ZodError);
        });
    });

    describe('WithAdminInfoSchema', () => {
        test('should validate with admin info', () => {
            const dataWithAdminInfo = {
                adminInfo: {
                    notes: 'Administrative notes',
                    tags: ['important', 'review'],
                    flaggedAt: new Date(),
                    flaggedById: '550e8400-e29b-41d4-a716-446655440000',
                    flaggedReason: 'Content violation'
                }
            };

            expect(() => WithAdminInfoSchema.parse(dataWithAdminInfo)).not.toThrow();
        });

        test('should validate without admin info', () => {
            const dataWithoutAdminInfo = {};

            expect(() => WithAdminInfoSchema.parse(dataWithoutAdminInfo)).not.toThrow();
        });
    });

    describe('WithSeoSchema', () => {
        test('should validate with SEO data', () => {
            const dataWithSeo = {
                seo: {
                    title: 'This is a valid SEO title with at least 30 characters',
                    description:
                        'This is a valid SEO description that must have at least 70 characters to be considered valid for search engines',
                    keywords: ['keyword1', 'keyword2'],
                    ogImage: 'https://example.com/image.jpg'
                }
            };

            expect(() => WithSeoSchema.parse(dataWithSeo)).not.toThrow();
        });

        test('should validate without SEO data', () => {
            const dataWithoutSeo = {};

            expect(() => WithSeoSchema.parse(dataWithoutSeo)).not.toThrow();
        });
    });
});

describe('Generic Utility Schemas', () => {
    describe('PartialEntitySchema', () => {
        test('should make all fields optional', () => {
            const TestSchema = z.object({
                id: z.string(),
                name: z.string(),
                email: z.string().email(),
                age: z.number().int().min(0)
            });

            const PartialTestSchema = PartialEntitySchema(TestSchema);

            // All fields should be optional
            expect(() => PartialTestSchema.parse({})).not.toThrow();
            expect(() => PartialTestSchema.parse({ name: 'John' })).not.toThrow();
            expect(() =>
                PartialTestSchema.parse({ name: 'John', email: 'john@example.com' })
            ).not.toThrow();
        });

        test('should maintain validation rules for provided fields', () => {
            const TestSchema = z.object({
                email: z.string().email(),
                age: z.number().int().min(18)
            });

            const PartialTestSchema = PartialEntitySchema(TestSchema);

            // Invalid email should still fail
            expect(() => PartialTestSchema.parse({ email: 'invalid-email' })).toThrow(ZodError);

            // Invalid age should still fail
            expect(() => PartialTestSchema.parse({ age: 10 })).toThrow(ZodError);

            // Valid partial data should pass
            expect(() => PartialTestSchema.parse({ email: 'valid@example.com' })).not.toThrow();
        });
    });

    describe('NewEntityInputSchema', () => {
        test('should omit system-managed fields', () => {
            const TestSchema = z.object({
                id: z.string(),
                name: z.string(),
                description: z.string().optional(),
                createdAt: z.date(),
                updatedAt: z.date(),
                deletedAt: z.date().optional(),
                createdById: z.string(),
                updatedById: z.string(),
                deletedById: z.string().optional()
            });

            const NewEntitySchema = NewEntityInputSchema(TestSchema);

            // Should accept data without system fields
            const validInput = { name: 'Test Name', description: 'Test Description' };
            expect(() => NewEntitySchema.parse(validInput)).not.toThrow();

            // System fields should be omitted from the schema shape
            const parsedResult = NewEntitySchema.parse(validInput);
            expect(parsedResult).toEqual(validInput);
        });
    });
});

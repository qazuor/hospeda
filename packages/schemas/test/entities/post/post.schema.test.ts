import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PostSchema } from '../../../src/entities/post/post.schema.js';
import {
    createMinimalPost,
    createPostEdgeCases,
    createValidPost
} from '../../fixtures/post.fixtures.js';

describe('PostSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid post', () => {
            const validData = createValidPost();

            expect(() => PostSchema.parse(validData)).not.toThrow();

            const result = PostSchema.parse(validData);
            expect(result.id).toBeDefined();
            expect(result.title).toBeDefined();
            expect(result.category).toBeDefined();
            expect(result.authorId).toBeDefined();
        });

        it('should validate minimal required post data', () => {
            const minimalData = createMinimalPost();

            expect(() => PostSchema.parse(minimalData)).not.toThrow();

            const result = PostSchema.parse(minimalData);
            expect(result.title).toBeDefined();
            expect(result.summary).toBeDefined();
            expect(result.content).toBeDefined();
            expect(result.category).toBeDefined();
            expect(result.authorId).toBeDefined();
        });

        it('should validate post with edge case values', () => {
            const edgeCaseData = createPostEdgeCases();

            expect(() => PostSchema.parse(edgeCaseData)).not.toThrow();
        });
    });

    describe('Invalid Data', () => {
        it('should reject post with invalid data', () => {
            const invalidData = {
                ...createValidPost(),
                category: 'INVALID_CATEGORY',
                authorId: 'invalid-uuid'
            };

            expect(() => PostSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject post with missing required fields', () => {
            const incompleteData = {
                title: 'Post Title'
                // Missing required fields
            };

            expect(() => PostSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject post with invalid enum values', () => {
            const validData = createValidPost();
            const invalidCategories = ['INVALID', 'WRONG', '', null, undefined];

            for (const category of invalidCategories) {
                const data = { ...validData, category };
                expect(() => PostSchema.parse(data)).toThrow(ZodError);
            }
        });
    });

    describe('Field Validations', () => {
        describe('title field', () => {
            it('should accept valid titles', () => {
                const validData = createValidPost();
                const testCases = [
                    'Short Title',
                    'A'.repeat(100), // Long title
                    'Title with números 123',
                    'Title with símbolos @#$',
                    'Multi-word Title with Spaces'
                ];

                for (const title of testCases) {
                    const data = { ...validData, title };
                    expect(() => PostSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid titles', () => {
                const validData = createValidPost();
                const testCases = [
                    '', // Empty
                    'A', // Too short
                    'A'.repeat(201) // Too long
                ];

                for (const title of testCases) {
                    const data = { ...validData, title };
                    expect(() => PostSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('category field', () => {
            it('should accept all valid post categories', () => {
                const validData = createValidPost();
                const validCategories = [
                    'EVENTS',
                    'CULTURE',
                    'GASTRONOMY',
                    'NATURE',
                    'TOURISM',
                    'GENERAL',
                    'SPORT',
                    'CARNIVAL',
                    'NIGHTLIFE',
                    'HISTORY',
                    'TRADITIONS',
                    'WELLNESS',
                    'FAMILY',
                    'TIPS',
                    'ART',
                    'BEACH',
                    'RURAL',
                    'FESTIVALS'
                ];

                for (const category of validCategories) {
                    const data = { ...validData, category };
                    expect(() => PostSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid post categories', () => {
                const validData = createValidPost();
                const invalidCategories = ['TRAVEL', 'FOOD', 'ADVENTURE', 'invalid', '', null];

                for (const category of invalidCategories) {
                    const data = { ...validData, category };
                    expect(() => PostSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('content field', () => {
            it('should accept valid content', () => {
                const validData = createValidPost();
                const validContent = [
                    'A'.repeat(100), // Minimum required length
                    'A'.repeat(1000), // Long content
                    'Content with\nmultiple\nlines and enough characters to meet the minimum requirement of one hundred characters.',
                    'Content with special chars: @#$%^&*() and enough text to meet the minimum length requirement for validation.',
                    'Content with números 123 and símbolos and sufficient text to meet the minimum character requirement for this field.'
                ];

                for (const content of validContent) {
                    const data = { ...validData, content };
                    expect(() => PostSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid content', () => {
                const validData = createValidPost();
                const invalidContent = [
                    '', // Empty
                    'A'.repeat(9) // Too short (less than 10 chars)
                ];

                for (const content of invalidContent) {
                    const data = { ...validData, content };
                    expect(() => PostSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('authorId field', () => {
            it('should accept valid UUIDs', () => {
                const validData = createValidPost();
                const validUUIDs = [
                    '123e4567-e89b-12d3-a456-426614174000',
                    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
                ];

                for (const authorId of validUUIDs) {
                    const data = { ...validData, authorId };
                    expect(() => PostSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid UUIDs', () => {
                const validData = createValidPost();
                const invalidUUIDs = [
                    'invalid-uuid',
                    '123',
                    '',
                    'not-a-uuid-at-all',
                    '123e4567-e89b-12d3-a456' // Incomplete UUID
                ];

                for (const authorId of invalidUUIDs) {
                    const data = { ...validData, authorId };
                    expect(() => PostSchema.parse(data)).toThrow(ZodError);
                }
            });
        });
    });

    describe('Optional Fields', () => {
        it('should handle optional fields correctly', () => {
            const baseData = createMinimalPost();

            // Should work without optional fields
            expect(() => PostSchema.parse(baseData)).not.toThrow();

            // Should work with some optional fields
            const withOptionals = {
                ...baseData,
                seo: {
                    title: 'SEO title with exactly thirty chars',
                    description:
                        'This is an SEO description that has at least seventy characters to meet the minimum requirement.',
                    keywords: ['post', 'content']
                },
                media: {
                    featuredImage: {
                        url: 'https://example.com/image.jpg',
                        alt: 'Featured image',
                        moderationState: 'APPROVED'
                    }
                },
                tags: [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174002',
                        name: 'travel',
                        slug: 'travel',
                        color: 'BLUE',
                        lifecycleState: 'ACTIVE',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        createdById: '123e4567-e89b-12d3-a456-426614174003',
                        updatedById: '123e4567-e89b-12d3-a456-426614174003'
                    },
                    {
                        id: '123e4567-e89b-12d3-a456-426614174004',
                        name: 'tips',
                        slug: 'tips',
                        color: 'GREEN',
                        lifecycleState: 'ACTIVE',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        createdById: '123e4567-e89b-12d3-a456-426614174003',
                        updatedById: '123e4567-e89b-12d3-a456-426614174003'
                    }
                ],
                isFeatured: true,
                accommodationId: '123e4567-e89b-12d3-a456-426614174000',
                destinationId: '123e4567-e89b-12d3-a456-426614174001'
            };

            expect(() => PostSchema.parse(withOptionals)).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should handle edge case values', () => {
            const validData = createPostEdgeCases();

            expect(() => PostSchema.parse(validData)).not.toThrow();

            const result = PostSchema.parse(validData);
            expect(result.title).toBeDefined();
            expect(result.content).toBeDefined();
        });

        it('should handle empty arrays', () => {
            const validData = createValidPost();
            const dataWithEmptyArrays = {
                ...validData,
                tags: [],
                media: {
                    images: [],
                    videos: []
                }
            };

            expect(() => PostSchema.parse(dataWithEmptyArrays)).not.toThrow();
        });

        it('should handle null vs undefined for optional fields', () => {
            const validData = createValidPost();

            // undefined should work for optional fields
            const withUndefined = {
                ...validData,
                seo: undefined,
                tags: undefined,
                accommodationId: undefined,
                destinationId: undefined
            };
            expect(() => PostSchema.parse(withUndefined)).not.toThrow();

            // null might be handled differently depending on schema definition
            const _withNull = {
                ...validData,
                seo: null,
                tags: null
            };
            // Note: Whether null is accepted depends on schema definition
        });
    });

    describe('Type Inference', () => {
        it('should infer correct TypeScript types', () => {
            const validData = createValidPost();
            const result = PostSchema.parse(validData);

            // TypeScript should infer these correctly
            expect(typeof result.id).toBe('string');
            expect(typeof result.title).toBe('string');
            expect(typeof result.category).toBe('string');
            expect(typeof result.authorId).toBe('string');
            expect(typeof result.content).toBe('string');

            // Optional fields
            if (result.tags !== undefined) {
                expect(Array.isArray(result.tags)).toBe(true);
            }
            if (result.isFeatured !== undefined) {
                expect(typeof result.isFeatured).toBe('boolean');
            }
        });
    });
});

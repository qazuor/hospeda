import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AddPostCommentInputSchema,
    LikePostInputSchema,
    RemovePostCommentInputSchema
} from '../../../src/entities/post/post.interactions.schema.js';

describe('Post Interactions Schemas', () => {
    describe('LikePostInputSchema', () => {
        it('should validate valid like input', () => {
            const validInput = {
                postId: faker.string.uuid()
            };

            expect(() => LikePostInputSchema.parse(validInput)).not.toThrow();

            const parsed = LikePostInputSchema.parse(validInput);
            expect(parsed.postId).toBe(validInput.postId);
        });

        it('should require postId field', () => {
            const invalidInput = {};

            expect(() => LikePostInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject invalid postId', () => {
            const invalidInput = {
                postId: 'not-a-uuid'
            };

            expect(() => LikePostInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject extra fields (strict mode)', () => {
            const invalidInput = {
                postId: faker.string.uuid(),
                extraField: 'not-allowed'
            };

            expect(() => LikePostInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('AddPostCommentInputSchema', () => {
        it('should validate valid comment input', () => {
            const validInput = {
                postId: faker.string.uuid(),
                comment: 'This is a great post!'
            };

            expect(() => AddPostCommentInputSchema.parse(validInput)).not.toThrow();

            const parsed = AddPostCommentInputSchema.parse(validInput);
            expect(parsed.postId).toBe(validInput.postId);
            expect(parsed.comment).toBe(validInput.comment);
        });

        it('should require both fields', () => {
            const invalidInput = {
                postId: faker.string.uuid()
                // Missing comment
            };

            expect(() => AddPostCommentInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject empty comment', () => {
            const invalidInput = {
                postId: faker.string.uuid(),
                comment: ''
            };

            expect(() => AddPostCommentInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject comment too long', () => {
            const invalidInput = {
                postId: faker.string.uuid(),
                comment: 'a'.repeat(1001) // Over 1000 chars
            };

            expect(() => AddPostCommentInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject extra fields (strict mode)', () => {
            const invalidInput = {
                postId: faker.string.uuid(),
                comment: 'Valid comment',
                extraField: 'not-allowed'
            };

            expect(() => AddPostCommentInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('RemovePostCommentInputSchema', () => {
        it('should validate valid remove comment input', () => {
            const validInput = {
                postId: faker.string.uuid(),
                commentId: faker.string.uuid()
            };

            expect(() => RemovePostCommentInputSchema.parse(validInput)).not.toThrow();

            const parsed = RemovePostCommentInputSchema.parse(validInput);
            expect(parsed.postId).toBe(validInput.postId);
            expect(parsed.commentId).toBe(validInput.commentId);
        });

        it('should require both fields', () => {
            const invalidInput = {
                postId: faker.string.uuid()
                // Missing commentId
            };

            expect(() => RemovePostCommentInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject invalid UUIDs', () => {
            const invalidInput = {
                postId: 'not-a-uuid',
                commentId: 'also-not-a-uuid'
            };

            expect(() => RemovePostCommentInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject extra fields (strict mode)', () => {
            const invalidInput = {
                postId: faker.string.uuid(),
                commentId: faker.string.uuid(),
                extraField: 'not-allowed'
            };

            expect(() => RemovePostCommentInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });
});

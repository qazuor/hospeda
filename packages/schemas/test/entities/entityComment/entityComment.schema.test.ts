import { describe, expect, it } from 'vitest';
import {
    COMMENT_CONTENT_MAX_LENGTH,
    CreateEntityCommentInputSchema,
    ModerateEntityCommentInputSchema,
    PUBLIC_THREAD_DEFAULT_PAGE_SIZE,
    PUBLIC_THREAD_MAX_PAGE_SIZE,
    PublicCommentThreadQuerySchema
} from '../../../src/entities/entityComment/index.js';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('CreateEntityCommentInputSchema', () => {
    const base = { entityType: 'POST', entityId: VALID_UUID, content: 'A valid comment' };

    it('accepts a valid POST comment input', () => {
        expect(CreateEntityCommentInputSchema.safeParse(base).success).toBe(true);
    });

    it('rejects empty content (min 1)', () => {
        const result = CreateEntityCommentInputSchema.safeParse({ ...base, content: '' });
        expect(result.success).toBe(false);
    });

    it(`rejects content over ${COMMENT_CONTENT_MAX_LENGTH} chars (AC-13)`, () => {
        const tooLong = 'x'.repeat(COMMENT_CONTENT_MAX_LENGTH + 1);
        const result = CreateEntityCommentInputSchema.safeParse({ ...base, content: tooLong });
        expect(result.success).toBe(false);
    });

    it(`accepts content at exactly ${COMMENT_CONTENT_MAX_LENGTH} chars (boundary)`, () => {
        const atMax = 'x'.repeat(COMMENT_CONTENT_MAX_LENGTH);
        expect(CreateEntityCommentInputSchema.safeParse({ ...base, content: atMax }).success).toBe(
            true
        );
    });

    it('is strict: rejects server-controlled fields in the input (authorId, moderationState)', () => {
        const withAuthor = CreateEntityCommentInputSchema.safeParse({
            ...base,
            authorId: VALID_UUID
        });
        const withState = CreateEntityCommentInputSchema.safeParse({
            ...base,
            moderationState: 'APPROVED'
        });
        expect(withAuthor.success).toBe(false);
        expect(withState.success).toBe(false);
    });
});

describe('ModerateEntityCommentInputSchema (publish-immediately model)', () => {
    it('accepts APPROVED', () => {
        expect(
            ModerateEntityCommentInputSchema.safeParse({ moderationState: 'APPROVED' }).success
        ).toBe(true);
    });

    it('accepts REJECTED', () => {
        expect(
            ModerateEntityCommentInputSchema.safeParse({ moderationState: 'REJECTED' }).success
        ).toBe(true);
    });

    it('rejects PENDING (not a valid API moderation transition)', () => {
        expect(
            ModerateEntityCommentInputSchema.safeParse({ moderationState: 'PENDING' }).success
        ).toBe(false);
    });

    it('rejects a missing moderationState', () => {
        expect(ModerateEntityCommentInputSchema.safeParse({}).success).toBe(false);
    });
});

describe('PublicCommentThreadQuerySchema', () => {
    it('applies defaults when no params are given', () => {
        const result = PublicCommentThreadQuerySchema.parse({});
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(PUBLIC_THREAD_DEFAULT_PAGE_SIZE);
    });

    it('coerces string query values', () => {
        const result = PublicCommentThreadQuerySchema.parse({ page: '2', pageSize: '30' });
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(30);
    });

    it(`rejects a pageSize above the ${PUBLIC_THREAD_MAX_PAGE_SIZE} ceiling`, () => {
        const result = PublicCommentThreadQuerySchema.safeParse({
            pageSize: PUBLIC_THREAD_MAX_PAGE_SIZE + 1
        });
        expect(result.success).toBe(false);
    });
});

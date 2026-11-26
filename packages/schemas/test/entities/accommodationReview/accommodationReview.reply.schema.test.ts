/**
 * HOS-2199: the host reply schemas. The public projection must never carry the
 * author or the moderation data.
 */
import { describe, expect, it } from 'vitest';
import {
    ACCOMMODATION_REVIEW_REPLY_MAX,
    AccommodationReviewReplyBodySchema,
    AccommodationReviewReplyPublicSchema,
    OwnerReceivedReviewsQuerySchema
} from '../../../src/entities/accommodationReview/accommodationReview.reply.schema.js';

describe('AccommodationReviewReplyBodySchema', () => {
    it('trims the text', () => {
        const parsed = AccommodationReviewReplyBodySchema.parse({ content: '  Gracias  ' });
        expect(parsed.content).toBe('Gracias');
    });

    it('rejects a blank reply', () => {
        expect(AccommodationReviewReplyBodySchema.safeParse({ content: '   ' }).success).toBe(
            false
        );
    });

    it('accepts exactly the maximum and rejects one more', () => {
        const ok = 'a'.repeat(ACCOMMODATION_REVIEW_REPLY_MAX);
        expect(AccommodationReviewReplyBodySchema.safeParse({ content: ok }).success).toBe(true);
        expect(AccommodationReviewReplyBodySchema.safeParse({ content: `${ok}a` }).success).toBe(
            false
        );
    });
});

describe('AccommodationReviewReplyPublicSchema', () => {
    it('drops the author and the moderation data', () => {
        const parsed = AccommodationReviewReplyPublicSchema.parse({
            content: 'Gracias',
            createdAt: '2026-11-01T00:00:00Z',
            editedAt: null,
            authorUserId: 'secret',
            moderationState: 'PENDING'
        });
        expect(Object.keys(parsed).sort()).toEqual(['content', 'createdAt', 'editedAt']);
    });
});

describe('OwnerReceivedReviewsQuerySchema', () => {
    it('defaults to the first page of ten, all reviews', () => {
        expect(OwnerReceivedReviewsQuerySchema.parse({})).toEqual({
            page: 1,
            pageSize: 10,
            unanswered: false
        });
    });

    it('is idempotent: parsing an already-parsed query still works (the route factory parses first)', () => {
        const once = OwnerReceivedReviewsQuerySchema.parse({ unanswered: 'true' });
        expect(OwnerReceivedReviewsQuerySchema.parse(once)).toEqual(once);
        expect(
            OwnerReceivedReviewsQuerySchema.parse(OwnerReceivedReviewsQuerySchema.parse({}))
        ).toEqual({
            page: 1,
            pageSize: 10,
            unanswered: false
        });
    });

    it('reads unanswered=true from the query string', () => {
        expect(OwnerReceivedReviewsQuerySchema.parse({ unanswered: 'true' }).unanswered).toBe(true);
    });
});

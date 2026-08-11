/**
 * @file merge-saved-reply.test.ts
 * @description Tests the reply merge of the provider's panel (HOS-376 T-051).
 *
 * This exists because the rule it pins is INVISIBLE through a rendered
 * assertion. `moderationReason` is only printed while a reply is REJECTED, and
 * the merge only ever runs on a reply that was just written — which is always
 * PENDING. A panel-level test that carried the stale reason over would therefore
 * pass either way; it was written first, and it did (the mutation survived).
 *
 * The reason it still matters at this layer: the row is the panel's model of
 * the reply, and a model that keeps a decision the API discarded is one render
 * change away from printing it.
 */

import { describe, expect, it } from 'vitest';
import {
    mergeSavedReply,
    type ReplyByReviewId
} from '../../../../src/components/host/host-trades/merge-saved-reply';

const REVIEW_ID = 'review-1';
const OTHER_REVIEW_ID = 'review-2';

/** A reply that a moderator turned down, with the reason still attached. */
const REJECTED: ReplyByReviewId[string] = {
    id: 'reply-1',
    content: 'Respuesta vieja',
    moderationState: 'REJECTED',
    moderationReason: 'Incluía la dirección del anfitrión.',
    reviewEditedAfterReply: false,
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z'
};

/** The rewritten reply, as `PATCH /replies/{id}` hands it back. */
const SAVED = {
    id: 'reply-1',
    reviewId: REVIEW_ID,
    content: 'Respuesta nueva, ya lo solucionamos.',
    moderationState: 'PENDING' as const,
    reviewEditedAfterReply: false,
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z'
};

describe('mergeSavedReply', () => {
    it('should drop the moderation reason the edit invalidated (AC-23)', () => {
        // Arrange
        const before: ReplyByReviewId = { [REVIEW_ID]: REJECTED };

        // Act
        const after = mergeSavedReply({
            replyByReviewId: before,
            reviewId: REVIEW_ID,
            saved: SAVED
        });

        // Assert — the rewrite discarded the decision, so its reason describes
        // a text that no longer exists.
        expect(after[REVIEW_ID]?.moderationReason).toBeNull();
    });

    it('should carry the saved content and state onto the row', () => {
        // Arrange
        const before: ReplyByReviewId = { [REVIEW_ID]: REJECTED };

        // Act
        const after = mergeSavedReply({
            replyByReviewId: before,
            reviewId: REVIEW_ID,
            saved: SAVED
        });

        // Assert
        expect(after[REVIEW_ID]).toMatchObject({
            id: SAVED.id,
            content: SAVED.content,
            moderationState: 'PENDING',
            reviewEditedAfterReply: false,
            createdAt: SAVED.createdAt,
            updatedAt: SAVED.updatedAt
        });
    });

    it('should leave every other row untouched', () => {
        // Arrange
        const before: ReplyByReviewId = { [REVIEW_ID]: null, [OTHER_REVIEW_ID]: REJECTED };

        // Act
        const after = mergeSavedReply({
            replyByReviewId: before,
            reviewId: REVIEW_ID,
            saved: SAVED
        });

        // Assert — answering one review must not restate another provider row.
        expect(after[OTHER_REVIEW_ID]).toBe(REJECTED);
    });

    it('should not mutate the map it was given', () => {
        // Arrange
        const before: ReplyByReviewId = { [REVIEW_ID]: null };

        // Act
        mergeSavedReply({ replyByReviewId: before, reviewId: REVIEW_ID, saved: SAVED });

        // Assert — React bails out of a re-render when the reference is
        // unchanged, so an in-place write would save the reply and show nothing.
        expect(before[REVIEW_ID]).toBeNull();
    });
});

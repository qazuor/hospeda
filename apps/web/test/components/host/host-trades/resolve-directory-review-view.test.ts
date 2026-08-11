/**
 * @file resolve-directory-review-view.test.ts
 * @description What a directory review row is allowed to show
 * (HOS-376 T-053 + the open half of T-049).
 *
 * Every rule here is an absence, and an absence asserted on rendered output
 * cannot say WHY it is absent — "no reply block" looks identical whether the
 * answer was withheld by moderation or the row simply has none.
 */

import { describe, expect, it } from 'vitest';
import { resolveDirectoryReviewView } from '@/components/host/host-trades/resolve-directory-review-view';
import type { DirectoryReviewRow } from '@/lib/api/endpoints-protected';

/**
 * Builds a directory row with only the fields under test.
 *
 * @param overrides - Partial review/reply state to apply.
 * @returns A row shaped as the directory endpoint serves it.
 */
function buildRow(overrides: {
    rating?: DirectoryReviewRow['review']['rating'];
    content?: string | null;
    editedAt?: string | null;
    reply?: Partial<NonNullable<DirectoryReviewRow['reply']>> | null;
}): DirectoryReviewRow {
    const reply = overrides.reply;
    return {
        review: {
            id: 'review-1',
            hostTradeId: 'trade-1',
            hostUserId: 'user-1',
            overallRating: 4,
            rating: overrides.rating ?? null,
            averageRating: 4,
            respectedBenefit: true,
            content: overrides.content ?? null,
            moderationState: 'APPROVED',
            editedAt: overrides.editedAt ?? null,
            createdAt: '2026-08-01T10:00:00Z',
            updatedAt: '2026-08-01T10:00:00Z'
        },
        author: { id: 'user-1', displayName: 'Ana', image: null },
        reply:
            reply === null || reply === undefined
                ? null
                : {
                      id: 'reply-1',
                      reviewId: 'review-1',
                      content: 'Gracias por avisar.',
                      moderationState: 'APPROVED',
                      reviewEditedAfterReply: false,
                      createdAt: '2026-08-02T10:00:00Z',
                      updatedAt: '2026-08-02T10:00:00Z',
                      ...reply
                  }
    };
}

describe('resolveDirectoryReviewView', () => {
    describe('the answer', () => {
        it('should show an answer the endpoint served', () => {
            const view = resolveDirectoryReviewView({ row: buildRow({ reply: {} }) });

            expect(view.reply).not.toBeNull();
            expect(view.reply?.content).toBe('Gracias por avisar.');
        });

        it('should show no answer when the row carries none', () => {
            // `null` here means "no answer a reader may see". The endpoint omits
            // a PENDING or REJECTED one, so this branch covers both "never
            // answered" and "answered, not cleared" — and the page must not
            // distinguish them, which is the point.
            const view = resolveDirectoryReviewView({ row: buildRow({ reply: null }) });

            expect(view.reply).toBeNull();
            expect(view.showEditedAfterReplyNotice).toBe(false);
        });
    });

    describe('the edited-after-reply notice (T-049)', () => {
        it('should warn when the review changed after it was answered', () => {
            const view = resolveDirectoryReviewView({
                row: buildRow({ reply: { reviewEditedAfterReply: true } })
            });

            expect(view.showEditedAfterReplyNotice).toBe(true);
        });

        it('should stay silent when the review has not changed since', () => {
            const view = resolveDirectoryReviewView({
                row: buildRow({ reply: { reviewEditedAfterReply: false } })
            });

            expect(view.showEditedAfterReplyNotice).toBe(false);
        });

        it('should never warn without an answer to warn about', () => {
            // The notice qualifies a reply — it tells a reader that the text
            // above no longer answers the text beside it. With no reply on the
            // row there is nothing for it to qualify, even though the review
            // itself was edited.
            const view = resolveDirectoryReviewView({
                row: buildRow({ reply: null, editedAt: '2026-08-03T10:00:00Z' })
            });

            expect(view.showEditedAfterReplyNotice).toBe(false);
        });
    });

    describe('the breakdown', () => {
        it('should list every dimension the host scored', () => {
            const view = resolveDirectoryReviewView({
                row: buildRow({ rating: { workQuality: 5, punctuality: 4, treatment: 3 } })
            });

            expect(view.breakdown).toEqual([
                { key: 'workQuality', value: 5 },
                { key: 'punctuality', value: 4 },
                { key: 'treatment', value: 3 }
            ]);
        });

        it('should omit a dimension the host left out', () => {
            const view = resolveDirectoryReviewView({
                row: buildRow({ rating: { workQuality: 5 } })
            });

            expect(view.breakdown).toEqual([{ key: 'workQuality', value: 5 }]);
        });

        it('should show no breakdown when the review carries none', () => {
            const view = resolveDirectoryReviewView({ row: buildRow({ rating: null }) });

            expect(view.breakdown).toBeNull();
        });

        it('should show no breakdown when every dimension is absent', () => {
            // An empty object is not a breakdown — rendering its heading over
            // nothing would claim the host scored dimensions he skipped.
            const view = resolveDirectoryReviewView({ row: buildRow({ rating: {} }) });

            expect(view.breakdown).toBeNull();
        });

        it('should keep the dimensions in a fixed order regardless of the payload', () => {
            // JSONB round-trips do not guarantee key order, and a breakdown that
            // reorders itself between two reviews is unreadable at a glance.
            const view = resolveDirectoryReviewView({
                row: buildRow({ rating: { treatment: 3, workQuality: 5, punctuality: 4 } })
            });

            expect(view.breakdown?.map((entry) => entry.key)).toEqual([
                'workQuality',
                'punctuality',
                'treatment'
            ]);
        });
    });

    describe('the body', () => {
        it('should carry a written comment', () => {
            const view = resolveDirectoryReviewView({ row: buildRow({ content: 'Muy puntual.' }) });

            expect(view.content).toBe('Muy puntual.');
        });

        it('should treat a blank comment as none', () => {
            // A rating-only review is normal — the comment is optional. A body
            // of whitespace would render as an empty paragraph with its margins.
            const view = resolveDirectoryReviewView({ row: buildRow({ content: '   ' }) });

            expect(view.content).toBeNull();
        });
    });
});

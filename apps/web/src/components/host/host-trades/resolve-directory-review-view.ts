/**
 * @file resolve-directory-review-view.ts
 * @description What a directory review row may show (HOS-376 T-053, §6.4).
 *
 * Three of the four rules here are absences, and each absence means something
 * specific that the rendered output cannot express:
 *
 *  - **No answer** does not mean the provider stayed silent. The endpoint omits
 *    a reply that moderation has not cleared, so an unapproved answer and no
 *    answer reach this page identically — deliberately, because a reader must
 *    not be able to infer that a provider wrote something that was rejected.
 *  - **The edited-after-reply notice needs a reply to qualify.** It tells a
 *    reader that the review above no longer says what the answer beside it
 *    responded to. With no answer on the row there is nothing to qualify, even
 *    when the review itself was edited.
 *  - **No breakdown** covers both "the host skipped the detail" and "the object
 *    came back empty". Rendering the heading over nothing would claim scores
 *    the host never gave.
 *
 * The dimension ORDER is fixed here rather than taken from the payload: the
 * column is JSONB and key order does not survive a round-trip, so reading it
 * off the object would let two reviews on the same page list their dimensions
 * differently.
 */

import type { DirectoryReviewReply, DirectoryReviewRow } from '@/lib/api/endpoints-protected';

/** The dimensions of the optional breakdown, in the order they are shown. */
const BREAKDOWN_KEYS = ['workQuality', 'punctuality', 'treatment'] as const;

/** One scored dimension of a review's breakdown. */
export interface BreakdownEntry {
    readonly key: (typeof BREAKDOWN_KEYS)[number];
    readonly value: number;
}

/** A directory review row with every absence already decided. */
export interface DirectoryReviewView {
    /** The three-dimension detail, or `null` when the host scored none of it. */
    readonly breakdown: readonly BreakdownEntry[] | null;
    /** The written comment, or `null` when there is nothing to print. */
    readonly content: string | null;
    /** The provider's answer, or `null` when no reader may see one. */
    readonly reply: DirectoryReviewReply | null;
    /** Whether to warn that the review changed after the answer was written. */
    readonly showEditedAfterReplyNotice: boolean;
}

/**
 * Decides what one directory review row shows.
 *
 * @param params - The row as the directory endpoint served it.
 * @param params.row - The review, its author, and the cleared answer if any.
 * @returns The resolved view.
 */
export function resolveDirectoryReviewView({
    row
}: {
    readonly row: DirectoryReviewRow;
}): DirectoryReviewView {
    const rating = row.review.rating;
    const entries: BreakdownEntry[] = [];
    if (rating) {
        for (const key of BREAKDOWN_KEYS) {
            const value = rating[key];
            if (typeof value === 'number') {
                entries.push({ key, value });
            }
        }
    }

    const trimmed = row.review.content?.trim() ?? '';

    return {
        breakdown: entries.length > 0 ? entries : null,
        content: trimmed.length > 0 ? trimmed : null,
        reply: row.reply,
        showEditedAfterReplyNotice: row.reply !== null && row.reply.reviewEditedAfterReply
    };
}

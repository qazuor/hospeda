/**
 * @file merge-saved-reply.ts
 * @description Folds a saved reply back into the provider's panel (HOS-376 T-051).
 *
 * A function rather than an inline `setState` updater because of what it drops.
 * The two write endpoints return `HostTradeReviewReplyProtected`, which has NO
 * `moderationReason` — the panel row does. The gap has exactly one honest
 * filling, `null`, since BOTH write paths discard the standing moderation
 * decision (AC-23): a reply that was just rewritten is PENDING with nothing
 * decided about it yet, so the moderator's last reason no longer describes
 * anything on screen.
 *
 * Carrying the old reason over instead is INVISIBLE in today's UI — the row only
 * prints a reason while REJECTED, and a freshly saved reply is never REJECTED —
 * which is precisely why the rule lives in a pure function with its own test
 * rather than in a rendered assertion that would pass either way.
 */

import type { OwnerReviewReply, SavedReviewReply } from '@/lib/api/endpoints-protected';

/** Replies indexed by the review they answer. */
export type ReplyByReviewId = Readonly<Record<string, OwnerReviewReply | null>>;

/**
 * Returns the reply map with one row replaced by the reply just saved.
 *
 * @param params - The current map, the review answered, and the saved reply.
 * @returns A new map; the input is never mutated.
 */
export function mergeSavedReply({
    replyByReviewId,
    reviewId,
    saved
}: {
    readonly replyByReviewId: ReplyByReviewId;
    readonly reviewId: string;
    readonly saved: SavedReviewReply;
}): ReplyByReviewId {
    return {
        ...replyByReviewId,
        [reviewId]: {
            id: saved.id,
            content: saved.content,
            moderationState: saved.moderationState,
            moderationReason: null,
            reviewEditedAfterReply: saved.reviewEditedAfterReply,
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt
        }
    };
}

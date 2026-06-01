import { type EntityComment, EntityTypeEnum, ModerationStatusEnum } from '@repo/schemas';

/**
 * Counter helpers for keeping `posts.comments` in sync (SPEC-165 RD-7 / AC-24 /
 * AC-25). The live counter uses ±1 adjustments from the existing baseline value;
 * a full recount (`EntityCommentModel.countApprovedByPostId`) is reserved for
 * reconciliation only.
 */

/**
 * Whether a comment currently contributes to `posts.comments`: it must target a
 * POST, be APPROVED, and not be soft-deleted. Used before a delete/soft-delete to
 * decide whether the counter should be decremented.
 */
export function isCountedApprovedPostComment(comment: EntityComment): boolean {
    return (
        comment.entityType === EntityTypeEnum.POST &&
        comment.moderationState === ModerationStatusEnum.APPROVED &&
        !comment.deletedAt
    );
}

/**
 * The signed delta to apply to `posts.comments` for a moderation-state transition
 * on a (non-deleted) POST comment.
 *
 * - REJECTED/PENDING → APPROVED: `+1` (the comment becomes visible/counted).
 * - APPROVED → REJECTED/PENDING: `-1` (the comment leaves the count).
 * - no change in "counted" status: `0`.
 */
export function moderationCounterDelta(
    previous: EntityComment['moderationState'],
    next: EntityComment['moderationState']
): number {
    const wasCounted = previous === ModerationStatusEnum.APPROVED ? 1 : 0;
    const isCounted = next === ModerationStatusEnum.APPROVED ? 1 : 0;
    return isCounted - wasCounted;
}

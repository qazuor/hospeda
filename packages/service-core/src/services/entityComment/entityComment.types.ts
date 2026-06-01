import type { EntityComment } from '@repo/schemas';

/**
 * Per-invocation hook state for {@link EntityCommentService}. Used to carry the
 * pre-mutation comment snapshot from a `_before*` hook to the matching `_after*`
 * hook so the `posts.comments` counter can be adjusted correctly after the
 * write. Scoped to a single service call (never shared across requests).
 */
export interface EntityCommentHookState extends Record<string, unknown> {
    /** Snapshot captured before a soft-delete, so the after-hook knows whether it was counted. */
    softDeletedComment?: EntityComment;
    /** Snapshot captured before a hard-delete. */
    hardDeletedComment?: EntityComment;
    /** Snapshot captured before a restore. */
    restoredComment?: EntityComment;
}

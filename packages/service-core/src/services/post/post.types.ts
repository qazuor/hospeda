/**
 * Per-request hook state for PostService lifecycle hooks.
 * Replaces mutable instance fields with request-scoped context.
 */
export interface PostHookState {
    /** ID being updated.. set in update() override, read in _beforeUpdate. */
    updateId?: string;
    /** Post data captured before soft-delete for post-delete side effects. */
    deletedPost?: { slug: string; tagSlugs?: string[] };
    /** Post data captured before restore for post-restore side effects. */
    restoredPost?: { slug: string; tagSlugs?: string[] };
}

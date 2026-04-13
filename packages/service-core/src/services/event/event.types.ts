/**
 * Per-request hook state for EventService lifecycle hooks.
 * Replaces mutable instance fields with request-scoped context.
 */
export interface EventHookState {
    /** Entity data captured before soft-delete for post-delete side effects. */
    deletedEvent?: { slug: string; category?: string };
    /** Entity data captured before restore for post-restore side effects. */
    restoredEvent?: { slug: string; category?: string };
}

/**
 * Per-request hook state for EventService lifecycle hooks.
 * Replaces mutable instance fields with request-scoped context.
 */
export interface EventHookState extends Record<string, unknown> {
    /** Entity data captured before soft-delete for post-delete side effects. */
    deletedEvent?: { slug: string; category?: string };
    /** Entity data captured before restore for post-restore side effects. */
    restoredEvent?: { slug: string; category?: string };
    /** ID of the entity being hard-deleted, used for Cloudinary media cleanup. */
    deletedEntityId?: string;
}

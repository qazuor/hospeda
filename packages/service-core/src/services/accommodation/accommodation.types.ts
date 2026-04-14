/**
 * Per-request hook state for AccommodationService lifecycle hooks.
 * Replaces mutable instance fields with request-scoped context.
 */
export interface AccommodationHookState extends Record<string, unknown> {
    /** Entity data captured before soft-delete for post-delete side effects (revalidation). */
    deletedEntity?: { destinationId?: string; slug: string; type?: string };
    /** Entity data captured before restore for post-restore side effects (revalidation). */
    restoredAccommodation?: { slug: string; destinationId?: string; type?: string };
    /** ID of the entity being hard-deleted, used for Cloudinary media cleanup. */
    deletedEntityId?: string;
}

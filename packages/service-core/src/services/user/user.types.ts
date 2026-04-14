/**
 * Per-request hook state for UserService lifecycle hooks.
 * Replaces mutable instance fields with request-scoped context.
 */
export interface UserHookState extends Record<string, unknown> {
    /** ID of the user being hard-deleted, used for Cloudinary avatar cleanup. */
    deletedEntityId?: string;
}

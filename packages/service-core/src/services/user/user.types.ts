/**
 * Per-request hook state for UserService lifecycle hooks.
 * Replaces mutable instance fields with request-scoped context.
 */
export interface UserHookState extends Record<string, unknown> {
    /** ID of the user being hard-deleted, used for Cloudinary avatar cleanup fallback. */
    deletedEntityId?: string;
    /**
     * Cloudinary public_id read from the satellite column before hard delete.
     * Used by _afterHardDelete to delete the asset without URL parsing.
     * Falls back to the legacy path-construction strategy when null/undefined.
     */
    deletedImagePublicId?: string | null;
}

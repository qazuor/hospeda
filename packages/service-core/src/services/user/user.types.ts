/**
 * The public author projection of a user.
 *
 * This is the ONLY user shape any anonymous caller can obtain, and it is
 * deliberately narrow: nothing here is private (no email, phone, birth date,
 * address, roles, permissions, settings, onboarding state or audit columns).
 * It exists so the author page can render a byline without loosening
 * {@link UserService._canView}, which guards the full user row.
 *
 * Every field is computed from the row alone — never from the requesting
 * actor — so the payload is identical for every caller and safe to cache at
 * the edge.
 */
export interface UserPublicProfile {
    readonly id: string;
    readonly displayName: string | null;
    readonly slug: string;
    readonly avatar: string | null;
    readonly bio: string | null;
}

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

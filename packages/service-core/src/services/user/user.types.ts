import type { SocialNetworkRead } from '@repo/schemas';

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

    /**
     * `users.is_system_account` — `true` for a platform/service identity rather
     * than a person (HOS-375 §6.10.1).
     *
     * Projected because the author page's indexability gate (§6.5, condition 1)
     * runs in the web app and has no other source for it: a system account must
     * render `noindex` even when it has published items, a bio and an avatar
     * (AC-13), and the same predicate decides sitemap inclusion. Withholding the
     * flag here would leave the page unable to satisfy that criterion at all.
     *
     * It is a content-curation bit, not an authorization one, and it discloses
     * nothing the sitemap does not already disclose by omission. It is also a
     * pure column read, so the payload stays actor-blind and edge-cacheable.
     */
    readonly isSystemAccount: boolean;

    /**
     * The author's social profiles, present ONLY when the profile owner has set
     * `settings.publicProfileShowSocialNetworks` (HOS-375 §6.7). Absent — the
     * key omitted entirely, not `null` — when they have not.
     *
     * Note this is the one field here that is not a straight column read, and
     * it still satisfies the actor-blindness rule above: the branch reads the
     * OWNER's setting, never the requesting actor's. `settings` itself is never
     * returned.
     */
    readonly socialNetworks?: SocialNetworkRead;
}

/**
 * One entry of the public authors list — everything a sitemap URL needs.
 *
 * `updatedAt` becomes the entry's `<lastmod>`: the author page renders the
 * profile plus two content lists, so a profile edit really is a change to that
 * URL.
 */
export interface PublicAuthorListItem {
    /** The author's slug — the `/autores/<slug>/` segment. */
    readonly slug: string;
    /** When the author's user row last changed. */
    readonly updatedAt: Date;
}

/** Paginated result of {@link UserService.listPublicAuthors}. */
export interface PublicAuthorListOutput {
    /** The qualifying authors on this page, newest-changed first. */
    readonly items: readonly PublicAuthorListItem[];
    /** Pagination envelope, so the sitemap builder knows when to stop. */
    readonly pagination: {
        readonly page: number;
        readonly pageSize: number;
        /** Total qualifying authors across all pages, not just this one. */
        readonly total: number;
        readonly totalPages: number;
    };
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

/**
 * @file session-prefill.ts
 * @description Shared helpers for seeding a public lead form's contact fields
 * from the signed-in visitor's session.
 *
 * Extracted from `commerce-lead-fields.ts` (HOS-295) when the alliance lead form
 * needed the same behaviour: both forms are public, both take a contact name and
 * an email, and both are reached by visitors who are frequently already signed
 * in. The rule about what "pre-filled" means belongs in one place — see
 * {@link hasSessionPrefill}.
 *
 * Pure functions only — no React, no DOM.
 */

/**
 * The signed-in visitor, forwarded from `Astro.locals.user` by a page's
 * frontmatter. `null` for anonymous visitors, which stays the primary case for
 * every form that uses this.
 *
 * Only the two fields a lead form actually seeds are carried: island props are
 * serialized into the rendered HTML, so shipping the user id here would leak an
 * internal identifier into page source for no benefit.
 */
export interface SessionPrefillUser {
    readonly name: string | null;
    readonly email: string | null;
}

/**
 * Whether the session actually contributed a value to the contact fields.
 *
 * A session can carry an empty name (Better Auth stores `''` rather than null
 * for an account that never set one), so "signed in" is not the same as
 * "something was pre-filled" — a form must not claim it filled in something it
 * left blank.
 *
 * @param params.currentUser - Signed-in visitor, or null/undefined for guests
 * @returns True when at least one contact field was seeded from the session
 */
export function hasSessionPrefill({
    currentUser
}: {
    readonly currentUser?: SessionPrefillUser | null;
}): boolean {
    return Boolean(currentUser?.name || currentUser?.email);
}

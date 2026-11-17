/**
 * @file reviewer-display-name.ts
 * @description The one rule that turns a reviewer's user row into the name a
 * review shows (HOS-2330, D-8).
 *
 * The public accommodation reviews route and the owner-side `list_reviews` MCP
 * tool both call it, so the owner never sees a different author name than the
 * public list shows. It reads name fields only: an email, an id or an image is
 * not an input, so it cannot be an output.
 */

/** The name fields of a user row that the rule reads. */
export interface ReviewerNameFields {
    /** The name the user chose to show. */
    readonly displayName?: string | null;
    /** First name. */
    readonly firstName?: string | null;
    /** Last name. */
    readonly lastName?: string | null;
}

/**
 * Resolves the public display name of a reviewer: the chosen display name, else
 * the first name with the last name's initial (`Ana P.`), else the first name.
 *
 * @param params.reviewer - The reviewer's name fields
 * @returns The name, or `null` when the user has none
 *
 * @example
 * ```typescript
 * resolveReviewerDisplayName({ reviewer: { firstName: 'Ana', lastName: 'Pérez' } }); // 'Ana P.'
 * ```
 */
export function resolveReviewerDisplayName({
    reviewer
}: {
    readonly reviewer: ReviewerNameFields;
}): string | null {
    const { displayName, firstName, lastName } = reviewer;
    return (
        displayName ??
        (firstName && lastName ? `${firstName} ${lastName.charAt(0)}.` : (firstName ?? null))
    );
}

/**
 * Entities that can be tagged via the user-tag subsystem (`r_entity_tag`).
 *
 * The original 5 values (`ACCOMMODATION`, `DESTINATION`, `USER`, `POST`,
 * `EVENT`) are preserved. Four new values were added as part of SPEC-086
 * (tag system refactor) to support future tagging use-cases:
 *
 * - `CONVERSATION`: ready for post-SPEC-085 conversation tagging follow-up.
 * - `REVIEW`: operator tagging of review entities.
 * - `BILLING_SUBSCRIPTION`: billing-context tagging by billing admins.
 * - `PAYMENT`: payment-record tagging by billing admins.
 *
 * `POST` remains valid — users may apply personal USER tags to posts for
 * their own organization (D-019 from SPEC-086). This is orthogonal to the
 * PostTag subsystem, which lives in a separate `post_tags` table.
 *
 * `EXPERIENCE` and `GASTRONOMY` were appended so they can participate in the
 * user-bookmark (favorites) subsystem, reaching parity with accommodations,
 * destinations, events and posts. They are first-class domain entities
 * (SPEC-239 gastronomy, SPEC-240 experience) with their own tables, but had
 * never been added to this shared enum.
 */
export enum EntityTypeEnum {
    ACCOMMODATION = 'ACCOMMODATION',
    DESTINATION = 'DESTINATION',
    USER = 'USER',
    POST = 'POST',
    EVENT = 'EVENT',
    CONVERSATION = 'CONVERSATION',
    REVIEW = 'REVIEW',
    BILLING_SUBSCRIPTION = 'BILLING_SUBSCRIPTION',
    PAYMENT = 'PAYMENT',
    EXPERIENCE = 'EXPERIENCE',
    GASTRONOMY = 'GASTRONOMY'
}

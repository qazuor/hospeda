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
 *
 * `HOST_TRADE` was appended for HOS-981, so `qr_codes.entity_type` can name the
 * subject a `GENERATED` code was derived from through this enum rather than
 * free text. The other three subjects the QR system needs — `ACCOMMODATION`,
 * `GASTRONOMY` and `EXPERIENCE`, the three verticals of HOS-982 — were already
 * here; the provider was the only one missing.
 *
 * `PARTNER` was appended for HOS-1063, so `entity_views.entity_type` can name a
 * gold partner's public page. Unlike HOS-734's GASTRONOMY/EXPERIENCE widening,
 * which only had to widen the narrow Zod subset, this one pays a migration:
 * PARTNER was absent from this enum, therefore absent from `entity_type_enum`.
 *
 * NOTE ON ORDER — values are APPENDED, never inserted. `packages/db/test/
 * enum-consistency.test.ts` asserts `tsValues.join(',') === dbValues.join(',')`,
 * i.e. the TypeScript order must match the Postgres order exactly, and
 * `ALTER TYPE … ADD VALUE` appends at the end. Inserting a value mid-list would
 * make that guard demand a full type rebuild instead of a one-line migration.
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
    GASTRONOMY = 'GASTRONOMY',
    HOST_TRADE = 'HOST_TRADE',
    PARTNER = 'PARTNER'
}

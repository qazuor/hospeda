/**
 * Publication status of a listing — the state machine of `V/03` §9 (program
 * HOS-1352, piece V6; spec name: the `listing` state). Six states, thirteen
 * transitions (`PB1`..`PB13`).
 *
 * It lives on the three listing tables (`accommodations`, `gastronomies`,
 * `experiences`) as `publication_status` and replaces `lifecycle_state`,
 * `visibility` and `moderation_state`, which the paso-3 cut migration drops.
 *
 * - `DRAFT`: being configured; never public.
 * - `PUBLISHED`: public; occupies a quota slot.
 * - `UNPUBLISHED_BY_BILLING`: taken down by the system because coverage was lost
 *   or the listing is surplus; the only state the system brings back on its own.
 * - `ARCHIVED`: archived by the inactivity clock (`PB4`/`PB5`); its deletion
 *   date is announced in `deletion_announced_at`.
 * - `PURGED`: final. Its content was deleted (day 180, `PB9`) or by its owner
 *   (`PB12`); never republished, never counts for the quota.
 * - `MODERATED`: taken down by an admin with a reason (`PB10`); only an admin
 *   lifts it (`PB11`/`PB13`).
 */
export enum PublicationStatusEnum {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    UNPUBLISHED_BY_BILLING = 'UNPUBLISHED_BY_BILLING',
    ARCHIVED = 'ARCHIVED',
    MODERATED = 'MODERATED',
    PURGED = 'PURGED'
}

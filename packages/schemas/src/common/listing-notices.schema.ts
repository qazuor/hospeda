import { z } from 'zod';
import { PublicationStatusEnum } from '../enums/publication-status.enum.js';
import { TrialStatusEnum } from '../enums/trial-status.enum.js';

/** An ISO-8601 instant as the API serializes it. */
const InstantSchema = z.string().datetime({ offset: true });

/**
 * One notice about one of the owner's listings, as Mi Cuenta shows it (HOS-1492,
 * V8a.1b, `V/19` §4). The surface only READS what the core resolved; every
 * variant is a fact read from the listing, its last transition events and its
 * open fix request (H2 of the leaf notes):
 *
 * - `PURGED_BY_INACTIVITY` (row 20): the listing reached `PURGED` through a job
 *   (`PB9`, day 180): it existed and its content was deleted for inactivity.
 * - `PURGED_FROM_MODERATION` (row 31): an owner `PB12` over a `MODERATED` listing.
 * - `PURGED`: any other `PB12`; no row obliges a text beyond «deleted, does not
 *   come back».
 * - `ARCHIVED` (row 18): the announced deletion date, and whether the listing
 *   comes back on its own (only an archive by `PB4`; a `PB5` draft does not).
 * - `MODERATED` (row 24): the reason and since when. Both null for a listing that
 *   reached `MODERATED` without a recorded transition (the cut's write).
 * - `FIX_REQUESTED` (row 30): the open fix request.
 * - `MODERATION_LIFTED` (row 30): where the listing went when the moderation was
 *   lifted, shown for 30 days (H13).
 * - `SURPLUS` (rows 8 and 9): `UNPUBLISHED_BY_BILLING` while the owner is
 *   covered, i.e. lowered by the quota (H6).
 */
export const ListingNoticeSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('PURGED_BY_INACTIVITY') }),
    z.object({ kind: z.literal('PURGED_FROM_MODERATION') }),
    z.object({ kind: z.literal('PURGED') }),
    z.object({
        kind: z.literal('ARCHIVED'),
        /** `deletion_announced_at`: from when the content is deleted. */
        deletionAnnouncedAt: InstantSchema.nullable(),
        /** True only for an archive by `PB4` (from `PUBLISHED` or `UNPUBLISHED_BY_BILLING`). */
        returnsOnItsOwn: z.boolean()
    }),
    z.object({
        kind: z.literal('MODERATED'),
        reason: z.string().nullable(),
        since: InstantSchema.nullable()
    }),
    z.object({
        kind: z.literal('FIX_REQUESTED'),
        reason: z.string(),
        /** The admin's suggested date (`YYYY-MM-DD`), when given. */
        suggestedDate: z.string().nullable(),
        openedAt: InstantSchema,
        /** When the owner reported the fix; null until then. */
        ownerReportedFixedAt: InstantSchema.nullable()
    }),
    z.object({
        kind: z.literal('MODERATION_LIFTED'),
        /** The status the lift left the listing in. */
        returnedTo: z.nativeEnum(PublicationStatusEnum),
        at: InstantSchema,
        /** Whether a fix request is still open after the lift. */
        fixRequestOpen: z.boolean()
    }),
    z.object({ kind: z.literal('SURPLUS') })
]);

/** One notice about a listing (rows 8/9, 18, 20, 24, 30, 31). */
export type ListingNotice = z.infer<typeof ListingNoticeSchema>;

/** The closed list of notice kinds. */
export type ListingNoticeKind = ListingNotice['kind'];

/** One listing of the owner with its notices. */
export const ListingNoticesItemSchema = z.object({
    listingId: z.string().uuid(),
    publicationStatus: z.nativeEnum(PublicationStatusEnum),
    /**
     * How many recurring add-ons (`ADDON`, scope `LISTING`, `until` with no known
     * date) target this listing: they keep being charged until cancelled (H7).
     */
    recurringListingAddons: z.number().int().nonnegative(),
    notices: z.array(ListingNoticeSchema)
});

/** One listing with its notices. */
export type ListingNoticesItem = z.infer<typeof ListingNoticesItemSchema>;

/**
 * Response of `GET /api/v1/protected/publish/listing-notices/{vertical}` (H2):
 * every listing of the actor in the vertical, `PURGED` ones included, and
 * whether the actor's trial in the vertical is running (row 2).
 */
export const ListingNoticesResponseSchema = z.object({
    trialRunning: z.boolean(),
    items: z.array(ListingNoticesItemSchema)
});

/** Response of the listing-notices read. */
export type ListingNoticesResponse = z.infer<typeof ListingNoticesResponseSchema>;

/**
 * Response of `GET /api/v1/protected/publish/trial-summary/{vertical}` (row 4,
 * H3): the accumulated trial days and their origin. `NONE` when the person has
 * no trial row in the vertical. A row born consumed (no clock) carries null
 * dates and zero days.
 */
export const TrialSummaryResponseSchema = z.union([
    z.object({ status: z.literal('NONE') }),
    z.object({
        status: z.nativeEnum(TrialStatusEnum),
        startedAt: InstantSchema.nullable(),
        endsAt: InstantSchema.nullable(),
        totalDays: z.number().int().nonnegative(),
        origins: z.object({
            /** Days the trial plan granted at start (`totalDays - promo - support`). */
            base: z.number().int(),
            /** Days added by promo redemptions (`canje_de_trial.applied_days`). */
            promo: z.number().int().nonnegative(),
            /** Days added by support (`trial.extended`, action 11). */
            support: z.number().int().nonnegative()
        })
    })
]);

/** Response of the trial-summary read. */
export type TrialSummaryResponse = z.infer<typeof TrialSummaryResponseSchema>;

/**
 * Response of `POST /api/v1/protected/{vertical}/{id}/fix-request/report-fixed`
 * (row 30, H4): the instant the owner reported the fix. Idempotent: a second
 * report answers the first instant.
 */
export const ReportFixedResponseSchema = z.object({
    ownerReportedFixedAt: InstantSchema
});

/** Response of the report-fixed write. */
export type ReportFixedResponse = z.infer<typeof ReportFixedResponseSchema>;

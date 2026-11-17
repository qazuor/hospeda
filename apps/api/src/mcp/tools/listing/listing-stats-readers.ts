/**
 * @file listing-stats-readers.ts
 * @description The review reads of the owner tools. There are TWO readers, and
 * they are deliberately separate named functions with different visibility, so
 * an owner read can never leak into a public path (HOS-2335 spec §6.5, D-7):
 *
 * - {@link readLatestListingReviews} (HOS-2184 T-024, `get_listing_stats`): the
 *   PUBLIC view. It applies the visibility the public review lists apply
 *   (`ACTIVE` + `APPROVED`, not soft-deleted), which is also what the
 *   denormalized `reviewsCount` and `averageRating` of the listing count.
 * - {@link readOwnerListingReviews} (HOS-2330, `list_reviews`): the OWNER view.
 *   Every moderation state, `PENDING` and `REJECTED` included, but never a
 *   soft-deleted or non-`ACTIVE` row. The caller establishes which listings are
 *   the actor's; this reader trusts the ids it is given.
 *
 * The review services only expose unsorted lists (up to 100 rows), so both need
 * the review models' own sorted read.
 *
 * Models are built lazily: nothing here touches `@repo/db` at import time.
 */

import { AccommodationReviewModel, ExperienceReviewModel, VenueReviewModel } from '@repo/db';
import { LifecycleStatusEnum, ModerationStatusEnum, VerticalEnum } from '@repo/schemas';
import { OWNER_REVIEWS_MAX_WINDOW } from '../review/owner-review-window';
import type { ListingToolVertical } from './listing-services';

/** One review as the tool reports it, before the text is wrapped. */
export interface LatestReviewRow {
    /** Review title, `null` when the reviewer left none. */
    readonly title: string | null;
    /** Review text, `null` when the reviewer left none. */
    readonly content: string | null;
    /** The review's own average rating (0 to 5). */
    readonly averageRating: number;
    /** When the review was written. */
    readonly createdAt: Date;
}

/** A review's moderation state, as the owner reads it. */
export type OwnerReviewModerationState = `${ModerationStatusEnum}`;

/** One review of the owner view, before its text is wrapped or excerpted. */
export interface OwnerReviewRow {
    /** Review id. */
    readonly id: string;
    /** Vertical of the reviewed listing. */
    readonly vertical: ListingToolVertical;
    /** Id of the reviewed listing. */
    readonly listingId: string;
    /** The reviewer's user id, only so the caller can resolve a display name. Never returned. */
    readonly reviewerId: string | null;
    /** Review title, `null` when the reviewer left none. */
    readonly title: string | null;
    /** Review text, `null` when the reviewer left none. */
    readonly content: string | null;
    /** The review's own average rating (0 to 5). */
    readonly averageRating: number;
    /** Moderation state. */
    readonly moderationState: OwnerReviewModerationState;
    /** When the review was written. */
    readonly createdAt: Date;
}

/** Review counts per moderation state. */
export type OwnerReviewCountsByState = Readonly<Record<OwnerReviewModerationState, number>>;

/** The listings of ONE vertical the owner view reads. */
export interface OwnerReviewScope {
    /** The vertical. */
    readonly vertical: ListingToolVertical;
    /** The listing ids, already known to be the actor's. */
    readonly listingIds: readonly string[];
}

/** Filters of the owner view. Each one narrows the result. */
export interface OwnerReviewFilters {
    /** Only reviews rated at least this. */
    readonly minRating?: number;
    /** Only reviews rated at most this. */
    readonly maxRating?: number;
    /** Only reviews written at or after this instant. */
    readonly since?: Date;
    /** Only reviews in this moderation state. */
    readonly moderationState?: OwnerReviewModerationState;
}

/** Result of {@link readOwnerListingReviews}. */
export interface OwnerReviewPage {
    /** The requested page, newest first. */
    readonly rows: readonly OwnerReviewRow[];
    /** Reviews that match every filter, all pages. */
    readonly total: number;
    /**
     * Reviews per moderation state under every filter EXCEPT `moderationState`, so
     * the owner sees the split even while looking at one state.
     */
    readonly countsByState: OwnerReviewCountsByState;
}

/** Foreign-key column of each vertical's review table. */
const LISTING_COLUMN = {
    [VerticalEnum.ACCOMMODATION]: 'accommodationId',
    [VerticalEnum.VENUE]: 'venueId',
    [VerticalEnum.EXPERIENCE]: 'experienceId'
} as const;

let accommodationReviews: AccommodationReviewModel | undefined;
let venueReviews: VenueReviewModel | undefined;
let experienceReviews: ExperienceReviewModel | undefined;

/** The review model of a vertical, built on first use. */
function reviewModelFor(vertical: ListingToolVertical) {
    if (vertical === VerticalEnum.ACCOMMODATION) {
        accommodationReviews ??= new AccommodationReviewModel();
        return accommodationReviews;
    }
    if (vertical === VerticalEnum.VENUE) {
        venueReviews ??= new VenueReviewModel();
        return venueReviews;
    }
    experienceReviews ??= new ExperienceReviewModel();
    return experienceReviews;
}

/**
 * Reads the most recent publicly visible reviews of a listing, newest first.
 * The caller has already established that the listing is the actor's.
 *
 * @param args - Vertical, listing id and how many reviews to return
 * @returns Up to `limit` reviews (empty when there are none)
 */
export async function readLatestListingReviews({
    vertical,
    listingId,
    limit
}: {
    readonly vertical: ListingToolVertical;
    readonly listingId: string;
    readonly limit: number;
}): Promise<readonly LatestReviewRow[]> {
    const result = await reviewModelFor(vertical).findAll(
        {
            [LISTING_COLUMN[vertical]]: listingId,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            deletedAt: null
        },
        { page: 1, pageSize: limit, sortBy: 'createdAt', sortOrder: 'desc' }
    );
    return (result.items as readonly LatestReviewRow[]).map((row) => ({
        title: row.title ?? null,
        content: row.content ?? null,
        averageRating: Number(row.averageRating),
        createdAt: new Date(row.createdAt)
    }));
}

/** The moderation states, in the order the counts are reported. */
const MODERATION_STATES = [
    ModerationStatusEnum.APPROVED,
    ModerationStatusEnum.PENDING,
    ModerationStatusEnum.REJECTED
] as const;

/** A review row as the models return it: only the columns this reader reads. */
interface RawReviewRow {
    readonly id: string;
    readonly userId?: string | null;
    readonly title?: string | null;
    readonly content?: string | null;
    readonly averageRating: number | string;
    readonly moderationState: OwnerReviewModerationState;
    readonly createdAt: Date | string;
    readonly [column: string]: unknown;
}

/** What one vertical's model answered. */
interface VerticalRead {
    readonly rows: readonly OwnerReviewRow[];
    readonly total: number;
    readonly countsByState: OwnerReviewCountsByState;
}

/**
 * The `where` of the owner view over one vertical, WITHOUT a moderation state:
 * the listing ids, the lifecycle and soft-delete exclusions, and the filters.
 * The exclusions are here and nowhere else, so every query built from it (rows,
 * total and the per-state counts) applies them.
 */
function ownerWhere({
    scope,
    filters
}: {
    readonly scope: OwnerReviewScope;
    readonly filters: OwnerReviewFilters;
}): Record<string, unknown> {
    return {
        [LISTING_COLUMN[scope.vertical]]: [...scope.listingIds],
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        deletedAt: null,
        ...(filters.minRating === undefined ? {} : { averageRating_gte: filters.minRating }),
        ...(filters.maxRating === undefined ? {} : { averageRating_lte: filters.maxRating }),
        ...(filters.since === undefined ? {} : { createdAt_gte: filters.since })
    };
}

/** Reads the newest rows, the total and the per-state counts of one vertical. */
async function readVertical({
    scope,
    filters,
    window
}: {
    readonly scope: OwnerReviewScope;
    readonly filters: OwnerReviewFilters;
    readonly window: number;
}): Promise<VerticalRead> {
    const model = reviewModelFor(scope.vertical);
    const where = ownerWhere({ scope, filters });
    const [page, ...counts] = await Promise.all([
        model.findAll(
            {
                ...where,
                ...(filters.moderationState === undefined
                    ? {}
                    : { moderationState: filters.moderationState })
            },
            { page: 1, pageSize: window, sortBy: 'createdAt', sortOrder: 'desc', thenSortBy: 'id' }
        ),
        ...MODERATION_STATES.map((moderationState) => model.count({ ...where, moderationState }))
    ]);
    const column = LISTING_COLUMN[scope.vertical];
    const rows = (page.items as readonly RawReviewRow[]).map(
        (row): OwnerReviewRow => ({
            id: row.id,
            vertical: scope.vertical,
            listingId: String(row[column]),
            reviewerId: row.userId ?? null,
            title: row.title ?? null,
            content: row.content ?? null,
            averageRating: Number(row.averageRating),
            moderationState: row.moderationState,
            createdAt: new Date(row.createdAt)
        })
    );
    return {
        rows,
        total: page.total,
        countsByState: {
            APPROVED: counts[0] ?? 0,
            PENDING: counts[1] ?? 0,
            REJECTED: counts[2] ?? 0
        }
    };
}

/**
 * Reads one page of the reviews of the owner's listings, in EVERY moderation
 * state, newest first (HOS-2335 D-7). One read per vertical that has listings,
 * merged by date; it asks each vertical for the newest `page * pageSize` rows,
 * so `page * pageSize` must not exceed {@link OWNER_REVIEWS_MAX_WINDOW}.
 *
 * Soft-deleted and non-`ACTIVE` reviews never appear, in the rows or in any
 * count. The caller has already established that every listing id is the
 * actor's. This is NOT the public view: the public lists and `get_listing_stats`
 * use {@link readLatestListingReviews}.
 *
 * @param args - The listings by vertical, the filters and the page
 * @returns The page, the total and the counts per moderation state
 * @throws {RangeError} When `page * pageSize` exceeds {@link OWNER_REVIEWS_MAX_WINDOW}
 */
export async function readOwnerListingReviews({
    scopes,
    filters,
    page,
    pageSize
}: {
    readonly scopes: readonly OwnerReviewScope[];
    readonly filters: OwnerReviewFilters;
    readonly page: number;
    readonly pageSize: number;
}): Promise<OwnerReviewPage> {
    const window = page * pageSize;
    if (window > OWNER_REVIEWS_MAX_WINDOW) {
        throw new RangeError(
            `Review page window ${window} exceeds the maximum of ${OWNER_REVIEWS_MAX_WINDOW}`
        );
    }
    const reads = await Promise.all(
        scopes
            .filter((scope) => scope.listingIds.length > 0)
            .map((scope) => readVertical({ scope, filters, window }))
    );
    const merged = reads
        .flatMap((read) => read.rows)
        .sort(
            (a, b) =>
                b.createdAt.getTime() - a.createdAt.getTime() ||
                (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
        );
    return {
        rows: merged.slice((page - 1) * pageSize, window),
        total: reads.reduce((sum, read) => sum + read.total, 0),
        countsByState: {
            APPROVED: reads.reduce((sum, read) => sum + read.countsByState.APPROVED, 0),
            PENDING: reads.reduce((sum, read) => sum + read.countsByState.PENDING, 0),
            REJECTED: reads.reduce((sum, read) => sum + read.countsByState.REJECTED, 0)
        }
    };
}

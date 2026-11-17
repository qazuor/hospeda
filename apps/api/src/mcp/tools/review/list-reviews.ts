/**
 * @file list-reviews.ts
 * @description Tool `list_reviews` (HOS-2330, spec HOS-2335 §6.5, AC-C24 to
 * AC-C28): the reviews received on the connected owner's listings, across
 * accommodations, venues and experiences.
 *
 * No portal page shows an owner the reviews they received (`mi-cuenta/resenas`
 * lists the ones they WROTE), and reviews have no owner reply, so this tool is a
 * pure read with no portal destination of its own.
 *
 * What the owner sees (owner decision D-7): EVERY review of their own listings,
 * in every moderation state (`APPROVED`, `PENDING`, `REJECTED`), with its state
 * and its text. Soft-deleted and non-`ACTIVE` reviews never appear. The
 * staff-written `moderationReason` is not returned (spec §11 U-8). This is NOT
 * the public view: it reads through `readOwnerListingReviews`, a function apart
 * from the one `get_listing_stats` and the public lists use.
 *
 * The author is the public projection without the image (D-8): a display name
 * and nothing else, no email, no user id.
 *
 * Ownership: with a `listingId` the listing goes through the same get-own gate
 * as `get_listing` (a missing or foreign one is the uniform not-found); without
 * one the scope is the listings `list_my_listings` returns.
 *
 * Review titles, texts and author names are written by third parties, so each
 * is returned inside the untrusted-data envelope, in every state (C-5), and the
 * text is excerpted to the response budget.
 */

import { ModerationStatusEnum } from '@repo/schemas';
import { z } from 'zod';
import { type OwnListingRow, readOwnListingRow } from '../listing/get-listing';
import { readMyListings } from '../listing/list-my-listings';
import { listingRefusalLink, readListingRef } from '../listing/listing-refusal-actions';
import {
    LISTING_TOOL_VERTICALS,
    type ListingToolVertical,
    ListingToolVerticalSchema
} from '../listing/listing-services';
import {
    type OwnerReviewCountsByState,
    type OwnerReviewModerationState,
    type OwnerReviewRow,
    type OwnerReviewScope,
    readOwnerListingReviews
} from '../listing/listing-stats-readers';
import {
    excerptText,
    MCP_LIST_MAX_PAGE_SIZE,
    MCP_RESULT_MAX_CHARS,
    MCP_TEXT_EXCERPT_CHARS,
    measureResultChars
} from '../response-budget';
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import { UNTRUSTED_DATA_NOTICE, wrapUntrustedText } from '../untrusted-data';
import { OWNER_REVIEWS_MAX_WINDOW } from './owner-review-window';
import { readReviewerDisplayNames } from './reviewer-names';

/** Reviews per page when the call does not say. */
export const LIST_REVIEWS_DEFAULT_PAGE_SIZE = 10;

/** Longest review title. The review schema caps it at 200 characters. */
export const LIST_REVIEWS_TITLE_EXCERPT_CHARS = 200;

/**
 * Text excerpt lengths tried in order until the page fits the response budget.
 * The first is the budget's own excerpt length; a page of long texts, titles
 * and escapes steps down instead of overflowing the client's limit.
 */
export const LIST_REVIEWS_TEXT_EXCERPT_STEPS: readonly number[] = [
    MCP_TEXT_EXCERPT_CHARS,
    Math.floor(MCP_TEXT_EXCERPT_CHARS / 2),
    Math.floor(MCP_TEXT_EXCERPT_CHARS / 4),
    Math.floor(MCP_TEXT_EXCERPT_CHARS / 10)
];

/** Argentina's fixed UTC offset, the calendar the other owner tools report in. */
const ARGENTINA_OFFSET = '-03:00';

/** `since`: an instant (`2026-11-01T00:00:00-03:00`) or a calendar day (`2026-11-01`). */
const SinceSchema = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

/**
 * Input schema of `list_reviews`. One flat object (C-2); the rules between
 * fields live in the `superRefine`.
 */
export const ListReviewsInputSchema = z
    .object({
        vertical: ListingToolVerticalSchema.optional().describe(
            'Only reviews of listings of this vertical (accommodation, venue or experience). Omit for all three. Required when listingId is given.'
        ),
        listingId: z
            .uuid()
            .optional()
            .describe(
                "Only reviews of this listing (its id from list_my_listings; needs vertical). A listing that does not exist or is not the connected user's is reported as not found. Omit for all listings."
            ),
        minRating: z
            .number()
            .min(0)
            .max(5)
            .optional()
            .describe('Only reviews rated at least this (0 to 5).'),
        maxRating: z
            .number()
            .min(0)
            .max(5)
            .optional()
            .describe('Only reviews rated at most this (0 to 5).'),
        since: SinceSchema.optional().describe(
            'Only reviews written on or after this: a day (YYYY-MM-DD, counted from 00:00 Argentina time) or an ISO 8601 instant.'
        ),
        moderationState: z
            .enum(ModerationStatusEnum)
            .optional()
            .describe(
                'Only reviews in this moderation state: APPROVED (public), PENDING (awaiting moderation, not public) or REJECTED (rejected by moderation, not public). Omit for all three.'
            ),
        page: z.number().int().min(1).default(1).describe('Page number, starting at 1.'),
        pageSize: z
            .number()
            .int()
            .min(1)
            .max(MCP_LIST_MAX_PAGE_SIZE)
            .default(LIST_REVIEWS_DEFAULT_PAGE_SIZE)
            .describe(`Reviews per page, up to ${MCP_LIST_MAX_PAGE_SIZE}.`)
    })
    .strict()
    .superRefine((input, ctx) => {
        if (input.listingId !== undefined && input.vertical === undefined) {
            ctx.addIssue({
                code: 'custom',
                path: ['vertical'],
                message: 'vertical is required when listingId is given'
            });
        }
        if (
            input.minRating !== undefined &&
            input.maxRating !== undefined &&
            input.minRating > input.maxRating
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['minRating'],
                message: 'minRating cannot be greater than maxRating'
            });
        }
        if (input.page * input.pageSize > OWNER_REVIEWS_MAX_WINDOW) {
            ctx.addIssue({
                code: 'custom',
                path: ['page'],
                message: `page * pageSize cannot exceed ${OWNER_REVIEWS_MAX_WINDOW}; narrow the search with since, vertical or listingId instead of paging deeper`
            });
        }
    });

/** The listing a review is about. */
export interface ReviewListingRef {
    /** The listing's vertical. */
    readonly vertical: ListingToolVertical;
    /** The listing id. */
    readonly id: string;
    /** The listing's public name. */
    readonly name: string;
}

/** One review in the result. */
export interface ReviewSummary {
    /** Review id. */
    readonly id: string;
    /** The reviewed listing. */
    readonly listing: ReviewListingRef;
    /** The review's average rating (0 to 5). */
    readonly rating: number;
    /** Title inside the untrusted-data envelope, `null` when the reviewer left none. */
    readonly title: string | null;
    /** Text (an excerpt, see `textTruncated`) inside the envelope, `null` when there is none. */
    readonly text: string | null;
    /** `true` when `text` or `title` was cut to fit the response budget. */
    readonly textTruncated: boolean;
    /** When the review was written (ISO 8601). */
    readonly createdAt: string;
    /** Moderation state: only `APPROVED` reviews are public. */
    readonly moderationState: OwnerReviewModerationState;
    /** The author, as the public reviews show them, without the image. */
    readonly reviewer: {
        /** Display name inside the envelope, `null` when the author has none. */
        readonly displayName: string | null;
    };
}

/** Result of `list_reviews`. */
export interface ListReviewsResult {
    /** The requested page, newest first. */
    readonly items: readonly ReviewSummary[];
    /** Reviews that match the filters, all pages. */
    readonly total: number;
    /** The page returned. */
    readonly page: number;
    /** The page size used. */
    readonly pageSize: number;
    /** `true` when more reviews follow this page. */
    readonly hasMore: boolean;
    /** Reviews per moderation state under the other filters (the state filter does not narrow it). */
    readonly countsByState: OwnerReviewCountsByState;
    /**
     * Present and `true` only when the owner has more listings than the scope
     * can hold (`list_my_listings` reports `hasMore`): the result then covers
     * part of them. Tell the user it is partial; pass vertical and listingId.
     */
    readonly incomplete?: true;
}

/** Turns a `since` into the instant it names. */
function sinceToDate(since: string): Date {
    return new Date(/T/.test(since) ? since : `${since}T00:00:00${ARGENTINA_OFFSET}`);
}

/** Projects the rows of a page to summaries, excerpting text to `textChars`. */
function toSummaries({
    rows,
    listings,
    reviewerNames,
    textChars
}: {
    readonly rows: readonly OwnerReviewRow[];
    readonly listings: ReadonlyMap<string, ReviewListingRef>;
    readonly reviewerNames: ReadonlyMap<string, string>;
    readonly textChars: number;
}): ReviewSummary[] {
    return rows.map((row) => {
        const title = row.title
            ? excerptText({
                  text: row.title,
                  maxChars: Math.min(LIST_REVIEWS_TITLE_EXCERPT_CHARS, textChars)
              })
            : null;
        const text = row.content ? excerptText({ text: row.content, maxChars: textChars }) : null;
        const reviewerName =
            row.reviewerId === null ? undefined : reviewerNames.get(row.reviewerId);
        return {
            id: row.id,
            listing: listings.get(`${row.vertical}:${row.listingId}`) ?? {
                vertical: row.vertical,
                id: row.listingId,
                name: ''
            },
            rating: row.averageRating,
            title:
                title === null ? null : wrapUntrustedText({ text: title.text, source: 'review' }),
            text: text === null ? null : wrapUntrustedText({ text: text.text, source: 'review' }),
            textTruncated: (title?.truncated ?? false) || (text?.truncated ?? false),
            createdAt: row.createdAt.toISOString(),
            moderationState: row.moderationState,
            reviewer: {
                displayName:
                    reviewerName === undefined
                        ? null
                        : wrapUntrustedText({ text: reviewerName, source: 'review_author' })
            }
        };
    });
}

/**
 * Builds the page with the longest excerpt that keeps the whole result inside
 * the response budget (spec §5.3).
 */
function fitToBudget({
    build
}: {
    readonly build: (input: { readonly textChars: number }) => ListReviewsResult;
}): ListReviewsResult {
    const steps = LIST_REVIEWS_TEXT_EXCERPT_STEPS;
    for (const textChars of steps.slice(0, -1)) {
        const result = build({ textChars });
        if (measureResultChars({ value: result }) <= MCP_RESULT_MAX_CHARS) {
            return result;
        }
    }
    // The shortest excerpt is the floor: nothing shorter is tried.
    return build({ textChars: steps[steps.length - 1] ?? 0 });
}

/** The listings a call reads reviews of, with their names. */
interface ReviewScope {
    readonly scopes: readonly OwnerReviewScope[];
    readonly listings: ReadonlyMap<string, ReviewListingRef>;
    readonly incomplete: boolean;
}

/** Scope of one listing, after the get-own gate. */
function scopeOfListing({
    vertical,
    row
}: {
    readonly vertical: ListingToolVertical;
    readonly row: OwnListingRow;
}): ReviewScope {
    return {
        scopes: [{ vertical, listingIds: [row.id] }],
        listings: new Map([[`${vertical}:${row.id}`, { vertical, id: row.id, name: row.name }]]),
        incomplete: false
    };
}

/**
 * `list_reviews`: read-only, available to an unverified email exactly as the
 * other owner reads are (`READ_OWN`).
 */
export const listReviewsTool = defineTool({
    name: 'list_reviews',
    title: 'Reseñas de mis publicaciones',
    description: `Lists the reviews received on the connected Hospeda user's listings (accommodations, venues and experiences), newest first, paginated (pageSize up to ${MCP_LIST_MAX_PAGE_SIZE}). It returns ALL the reviews of the user's own listings, whatever their moderation state: each carries "moderationState" (APPROVED = public; PENDING = awaiting moderation, not public; REJECTED = rejected by moderation, not public), so say which are public when you report them. Per review: id, the listing (vertical, id, name), rating (0 to 5), title, text, date, moderationState and the author's display name (nothing else about the author). "text" may be an excerpt: when "textTruncated" is true it was cut. The result also carries "total", "hasMore" and "countsByState" (APPROVED, PENDING and REJECTED counts under the other filters). Filters: vertical, listingId (needs vertical), minRating, maxRating, since, moderationState; combine them freely. Paging reaches the newest ${OWNER_REVIEWS_MAX_WINDOW} reviews of a search: use since, vertical or listingId to go further back. Reviews cannot be replied to or changed from here, and there is no "already replied" information. If "incomplete" is true the user may have more listings than one call covers (a conservative signal: it can be set even when nothing is missing): tell them the result might be partial and narrow with vertical and listingId. A listing that does not exist or belongs to someone else is reported as not found. Take vertical and listingId from list_my_listings. ${UNTRUSTED_DATA_NOTICE}`,
    inputSchema: ListReviewsInputSchema,
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    refusalAction: ({ error, input }) => {
        const ref = readListingRef({ input, idKey: 'listingId' });
        return ref === undefined ? undefined : listingRefusalLink({ error, ref });
    },
    handler: async ({ actor, input }): Promise<ToolHandlerResult<ListReviewsResult>> => {
        const { vertical, listingId, page, pageSize } = input;

        let reviewScope: ReviewScope;
        if (listingId !== undefined && vertical !== undefined) {
            const admitted = await readOwnListingRow({ actor, vertical, id: listingId });
            if (admitted.error) {
                return admitted.error;
            }
            reviewScope = scopeOfListing({ vertical, row: admitted.row });
        } else {
            const mine = await readMyListings({ actor });
            if (mine.error) {
                return { error: mine.error };
            }
            const wanted = mine.data.listings.filter(
                (listing) => vertical === undefined || listing.vertical === vertical
            );
            reviewScope = {
                scopes: LISTING_TOOL_VERTICALS.map((v) => ({
                    vertical: v,
                    listingIds: wanted.filter((l) => l.vertical === v).map((l) => l.id)
                })),
                listings: new Map(
                    wanted.map((l) => [
                        `${l.vertical}:${l.id}`,
                        { vertical: l.vertical, id: l.id, name: l.name }
                    ])
                ),
                incomplete: mine.data.hasMore
            };
        }

        const reviews = await readOwnerListingReviews({
            scopes: reviewScope.scopes,
            filters: {
                ...(input.minRating === undefined ? {} : { minRating: input.minRating }),
                ...(input.maxRating === undefined ? {} : { maxRating: input.maxRating }),
                ...(input.since === undefined ? {} : { since: sinceToDate(input.since) }),
                ...(input.moderationState === undefined
                    ? {}
                    : { moderationState: input.moderationState })
            },
            page,
            pageSize
        });
        const reviewerNames = await readReviewerDisplayNames({
            reviewerIds: reviews.rows.flatMap((row) =>
                row.reviewerId === null ? [] : [row.reviewerId]
            )
        });

        return {
            data: fitToBudget({
                build: ({ textChars }) => ({
                    items: toSummaries({
                        rows: reviews.rows,
                        listings: reviewScope.listings,
                        reviewerNames,
                        textChars
                    }),
                    total: reviews.total,
                    page,
                    pageSize,
                    // Paging reaches only the newest OWNER_REVIEWS_MAX_WINDOW reviews of a search.
                    hasMore: page * pageSize < Math.min(reviews.total, OWNER_REVIEWS_MAX_WINDOW),
                    countsByState: reviews.countsByState,
                    ...(reviewScope.incomplete ? { incomplete: true as const } : {})
                })
            })
        };
    }
});

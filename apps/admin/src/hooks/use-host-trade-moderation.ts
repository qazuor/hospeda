/**
 * @file use-host-trade-moderation.ts
 * @description TanStack Query hooks for the host-trade moderation queues
 * (HOS-376 T-055).
 *
 * Mirrors `use-comment-moderation.ts`: a query-key factory, typed response
 * shapes, API helpers, and named export hooks.
 *
 * TWO QUEUES, TWO MEANINGS — and that is why they get separate keys, separate
 * hooks and separate screens rather than one list with a type column:
 *
 *  - A **review** is born APPROVED (§6.4). Its pending pile is BACKLOG: nothing
 *    is blocked while it sits there, and the moderator's job is to find the
 *    occasional item that should come down.
 *  - A **reply** is born PENDING. Its pile is providers who cannot answer a
 *    complaint about their own business until a human clears them. Every hour
 *    it waits is an hour someone's side of the story is missing from a page
 *    other hosts are reading.
 *
 * Summed into one number, forty harmless items look exactly like forty blocked
 * providers. The API refuses to sum them and so does this.
 */

import type { HostTradeReviewAdmin, HostTradeReviewReplyAdmin } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Query keys for both host-trade moderation queues.
 *
 * The two queues branch under a shared root so a moderation decision can
 * invalidate exactly the list it touched, while the pending-count badge — which
 * reads both — invalidates from the root.
 */
export const hostTradeModerationQueryKeys = {
    all: ['host-trade-moderation'] as const,
    reviews: () => [...hostTradeModerationQueryKeys.all, 'reviews'] as const,
    reviewList: (filters: HostTradeReviewFilters) =>
        [...hostTradeModerationQueryKeys.reviews(), filters] as const,
    replies: () => [...hostTradeModerationQueryKeys.all, 'replies'] as const,
    replyList: (filters: HostTradeReplyFilters) =>
        [...hostTradeModerationQueryKeys.replies(), filters] as const,
    pendingCount: () => [...hostTradeModerationQueryKeys.all, 'pending-count'] as const
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The two verdicts a moderator may record. */
export type ModerationDecision = 'APPROVED' | 'REJECTED';

/**
 * The moderation states a row can be READ in.
 *
 * Wider than {@link ModerationDecision} on purpose: `PENDING` is a state a row
 * arrives in, never a verdict anyone may apply. Offering it as a decision would
 * let a moderator park an item back in the queue with no record of who moved it
 * or why — the one thing the moderation columns exist to prevent, and something
 * the API rejects outright.
 */
export type ModerationStateFilter = ModerationDecision | 'PENDING';

/** Pagination metadata returned by the API. */
interface PaginationMeta {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
}

/** Filters accepted by `GET /admin/host-trades/reviews`. */
export interface HostTradeReviewFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly moderationState?: ModerationStateFilter;
    readonly hostTradeId?: string;
    readonly hostUserId?: string;
    readonly respectedBenefit?: boolean;
    readonly search?: string;
}

/** Filters accepted by `GET /admin/host-trades/replies`. */
export interface HostTradeReplyFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly moderationState?: ModerationStateFilter;
    readonly reviewId?: string;
    readonly search?: string;
}

/** A paginated page of either queue. */
interface AdminListResponse<TItem> {
    readonly success: boolean;
    readonly data: {
        readonly items: TItem[];
        readonly pagination: PaginationMeta;
    };
}

/**
 * The badge's counts, exactly as the endpoint shapes them.
 *
 * `count` is the sum, present because a badge needs one number. `byType` is
 * what a moderator must actually read before deciding where to start: the two
 * piles mean different things, and only one of them is blocking anybody.
 */
export interface HostTradePendingCounts {
    readonly count: number;
    readonly byType: {
        readonly reviews: number;
        readonly replies: number;
    };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Serialises a filter object into query params, dropping what was not set.
 *
 * `undefined` is omitted rather than sent as the string "undefined", and
 * `respectedBenefit: false` is preserved — the API reads it with
 * `queryBooleanParam()` precisely because dropping or coercing a `false` here
 * would silently invert the one filter that surfaces providers who did NOT
 * honour the benefit.
 *
 * @param filters - The filter object to serialise.
 * @returns The encoded query string, without a leading `?`.
 */
function buildQuery(filters: object): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') {
            continue;
        }
        params.set(key, String(value));
    }
    return params.toString();
}

async function fetchReviews(
    filters: HostTradeReviewFilters
): Promise<AdminListResponse<HostTradeReviewAdmin>['data']> {
    const query = buildQuery(filters);
    const result = await fetchApi<AdminListResponse<HostTradeReviewAdmin>>({
        path: `/api/v1/admin/host-trades/reviews${query ? `?${query}` : ''}`
    });
    return result.data.data;
}

async function fetchReplies(
    filters: HostTradeReplyFilters
): Promise<AdminListResponse<HostTradeReviewReplyAdmin>['data']> {
    const query = buildQuery(filters);
    const result = await fetchApi<AdminListResponse<HostTradeReviewReplyAdmin>>({
        path: `/api/v1/admin/host-trades/replies${query ? `?${query}` : ''}`
    });
    return result.data.data;
}

async function moderateReviewRequest(input: {
    id: string;
    decision: ModerationDecision;
    reason?: string;
}): Promise<HostTradeReviewAdmin> {
    const body: Record<string, unknown> = { decision: input.decision };
    if (input.reason !== undefined && input.reason !== '') {
        body.reason = input.reason;
    }

    const result = await fetchApi<{ data: { review: HostTradeReviewAdmin } }>({
        path: `/api/v1/admin/host-trades/reviews/${input.id}/moderate`,
        method: 'POST',
        body
    });
    return result.data.data.review;
}

async function moderateReplyRequest(input: {
    id: string;
    decision: ModerationDecision;
    reason?: string;
}): Promise<HostTradeReviewReplyAdmin> {
    const body: Record<string, unknown> = { decision: input.decision };
    if (input.reason !== undefined && input.reason !== '') {
        body.reason = input.reason;
    }

    const result = await fetchApi<{ data: { reply: HostTradeReviewReplyAdmin } }>({
        path: `/api/v1/admin/host-trades/replies/${input.id}/moderate`,
        method: 'POST',
        body
    });
    return result.data.data.reply;
}

async function fetchPendingCounts(): Promise<HostTradePendingCounts> {
    const result = await fetchApi<{ data: HostTradePendingCounts }>({
        path: '/api/v1/admin/moderation/host-trade-reviews/pending-count'
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the review queue — every moderation state unless filtered.
 *
 * Deliberately NOT scoped to PENDING by default: a queue that could only show
 * what is already published would have nothing to moderate.
 *
 * @param filters - Pagination and filter parameters.
 * @returns A TanStack Query result holding the page and its pagination.
 */
export function useHostTradeReviewsQueue(filters: HostTradeReviewFilters = {}) {
    return useQuery({
        queryKey: hostTradeModerationQueryKeys.reviewList(filters),
        queryFn: () => fetchReviews(filters),
        staleTime: 30_000
    });
}

/**
 * Fetches the reply queue.
 *
 * @param filters - Pagination and filter parameters.
 * @returns A TanStack Query result holding the page and its pagination.
 */
export function useHostTradeRepliesQueue(filters: HostTradeReplyFilters = {}) {
    return useQuery({
        queryKey: hostTradeModerationQueryKeys.replyList(filters),
        queryFn: () => fetchReplies(filters),
        staleTime: 30_000
    });
}

/**
 * Fetches the two pending counts for the moderation badge.
 *
 * @returns A TanStack Query result holding both counts and their sum.
 */
export function useHostTradePendingCounts() {
    return useQuery({
        queryKey: hostTradeModerationQueryKeys.pendingCount(),
        queryFn: fetchPendingCounts,
        staleTime: 60_000
    });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Records a verdict on a review.
 *
 * Invalidates the whole moderation root rather than just the review list:
 * rejecting a review also moves the badge, and the two must never disagree
 * about how much work is waiting.
 *
 * @returns A TanStack Query mutation result.
 */
export function useModerateHostTradeReview() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: moderateReviewRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: hostTradeModerationQueryKeys.all });
        }
    });
}

/**
 * Records a verdict on a provider's reply.
 *
 * @returns A TanStack Query mutation result.
 */
export function useModerateHostTradeReply() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: moderateReplyRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: hostTradeModerationQueryKeys.all });
        }
    });
}

/**
 * @file use-accommodation-review-reply-moderation.ts
 * @description TanStack Query hooks for the accommodation-review reply
 * moderation queue (HOS-2675).
 *
 * Mirrors `use-host-trade-moderation.ts`: a query-key factory, typed response
 * shapes, API helpers, and named export hooks.
 */

import type { AccommodationReviewReply, AccommodationReviewReplyAdminItem } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

import type { ModerationDecision, ModerationStateFilter } from './use-host-trade-moderation';

export type { ModerationDecision, ModerationStateFilter };

/** Query keys for the accommodation-review reply moderation queue. */
export const accommodationReviewReplyModerationQueryKeys = {
    all: ['accommodation-review-reply-moderation'] as const,
    replies: () => [...accommodationReviewReplyModerationQueryKeys.all, 'replies'] as const,
    replyList: (filters: AccommodationReviewReplyFilters) =>
        [...accommodationReviewReplyModerationQueryKeys.replies(), filters] as const
};

/** Pagination metadata returned by the API. */
export interface ReplyModerationPaginationMeta {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
}

/** Filters accepted by `GET /admin/accommodations/reviews/replies`. */
export interface AccommodationReviewReplyFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly accommodationId?: string;
    readonly moderationState?: ModerationStateFilter;
}

/** A paginated page of the reply queue. */
export interface AccommodationReviewReplyPage {
    readonly items: AccommodationReviewReplyAdminItem[];
    readonly pagination: ReplyModerationPaginationMeta;
}

/** The moderation input accepted by the reply mutation. */
export interface ModerateAccommodationReviewReplyInput {
    readonly id: string;
    readonly decision: ModerationDecision;
    readonly reason?: string;
}

/**
 * Serialises a filter object into query params, dropping what was not set.
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

async function fetchReplies(
    filters: AccommodationReviewReplyFilters
): Promise<AccommodationReviewReplyPage> {
    const query = buildQuery(filters);
    const result = await fetchApi<{ success: boolean; data: AccommodationReviewReplyPage }>({
        path: `/api/v1/admin/accommodations/reviews/replies${query ? `?${query}` : ''}`
    });
    return result.data.data;
}

async function moderateReplyRequest(
    input: ModerateAccommodationReviewReplyInput
): Promise<AccommodationReviewReply> {
    const body: Record<string, unknown> = { decision: input.decision };
    if (input.reason !== undefined && input.reason !== '') {
        body.reason = input.reason;
    }

    const result = await fetchApi<{ data: AccommodationReviewReply }>({
        path: `/api/v1/admin/accommodations/reviews/replies/${input.id}/moderate`,
        method: 'POST',
        body
    });
    return result.data.data;
}

/**
 * Fetches the reply moderation queue.
 *
 * Deliberately NOT scoped to PENDING by default: an APPROVED reply may still
 * need to be taken down. The caller narrows it from the UI filter.
 *
 * @param filters - Pagination and filter parameters.
 * @returns A TanStack Query result holding the page and its pagination.
 */
export function useAccommodationReviewRepliesQueue(filters: AccommodationReviewReplyFilters = {}) {
    return useQuery({
        queryKey: accommodationReviewReplyModerationQueryKeys.replyList(filters),
        queryFn: () => fetchReplies(filters),
        staleTime: 30_000
    });
}

/**
 * Records a verdict on a reply.
 *
 * Invalidates the whole moderation root so every filtered list refreshes.
 *
 * @returns A TanStack Query mutation result.
 */
export function useModerateAccommodationReviewReply() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: moderateReplyRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: accommodationReviewReplyModerationQueryKeys.all
            });
        }
    });
}

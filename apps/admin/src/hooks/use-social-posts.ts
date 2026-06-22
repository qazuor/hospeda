/**
 * @file use-social-posts.ts
 * @description TanStack Query hooks for the admin social posts list page (SPEC-254 T-039).
 *
 * Mirrors the structure of use-comment-moderation.ts: a query-key factory,
 * typed response shapes, API helper functions, and named export hooks.
 * Includes an optimistic approve mutation with rollback on error.
 */

import { fetchApi } from '@/lib/api/client';
import type { SocialPostListItem } from '@repo/service-core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Query key factory for social post queries.
 * All list keys share the same root so `invalidateQueries` on `lists()` busts
 * all list variants in one call.
 */
export const socialPostQueryKeys = {
    all: ['social-posts'] as const,
    lists: () => [...socialPostQueryKeys.all, 'list'] as const,
    list: (filters: SocialPostListFilters) => [...socialPostQueryKeys.lists(), filters] as const,
    detail: (id: string) => [...socialPostQueryKeys.all, 'detail', id] as const
};

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/** Pagination metadata returned by the API. */
interface PaginationMeta {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
}

/** Wrapper shape returned by the API for the admin social post list endpoint. */
interface SocialPostListResponse {
    readonly success: boolean;
    readonly data: {
        readonly items: SocialPostListItem[];
        readonly pagination: PaginationMeta;
    };
}

/** Wrapper shape returned by the approve endpoint. */
interface ApproveSocialPostResponse {
    readonly success: boolean;
    readonly data: {
        readonly id: string;
        readonly status: string;
        readonly approvalStatus: string;
    };
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

/**
 * Filters accepted by the admin social post list endpoint.
 * Maps to the query params in SocialPostAdminSearchSchema.
 */
export interface SocialPostListFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly search?: string;
    readonly status?: string;
    readonly approvalStatus?: string;
    readonly platform?: string;
    readonly batchId?: string;
    readonly campaignId?: string;
}

// ---------------------------------------------------------------------------
// API helper functions
// ---------------------------------------------------------------------------

async function fetchSocialPostsList(
    filters: SocialPostListFilters
): Promise<SocialPostListResponse['data']> {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.approvalStatus) params.set('approvalStatus', filters.approvalStatus);
    if (filters.platform) params.set('platform', filters.platform);
    if (filters.batchId) params.set('batchId', filters.batchId);
    if (filters.campaignId) params.set('campaignId', filters.campaignId);

    const query = params.toString();
    const path = `/api/v1/admin/social/posts${query ? `?${query}` : ''}`;

    const result = await fetchApi<SocialPostListResponse>({ path });
    return result.data.data;
}

async function approveSocialPostRequest(id: string): Promise<ApproveSocialPostResponse['data']> {
    const result = await fetchApi<ApproveSocialPostResponse>({
        path: `/api/v1/admin/social/posts/${id}/approve`,
        method: 'POST'
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the paginated, filterable list of social posts for admin review.
 *
 * Gate: caller must have SOCIAL_POST_VIEW (enforced server-side).
 *
 * @param filters - Pagination and filter parameters
 */
export function useSocialPostsList(filters: SocialPostListFilters = {}) {
    return useQuery({
        queryKey: socialPostQueryKeys.list(filters),
        queryFn: () => fetchSocialPostsList(filters),
        staleTime: 30_000
    });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Optimistic approve mutation.
 *
 * On `onMutate`: immediately marks the target post's `approvalStatus` as
 * `APPROVED` in the cached list so the UI reflects the change instantly.
 * On `onError`: rolls back to the previous snapshot.
 * On `onSettled`: always invalidates the list queries to sync with server.
 *
 * Gate: caller must have SOCIAL_POST_APPROVE (enforced server-side).
 */
export function useApproveSocialPost() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => approveSocialPostRequest(id),

        onMutate: async (id: string) => {
            // Cancel in-flight refetches to prevent race conditions.
            await queryClient.cancelQueries({ queryKey: socialPostQueryKeys.lists() });

            // Snapshot all matching list caches for rollback.
            const previousData = queryClient.getQueriesData<SocialPostListResponse['data']>({
                queryKey: socialPostQueryKeys.lists()
            });

            // Optimistically update every list cache that contains the post.
            queryClient.setQueriesData<SocialPostListResponse['data']>(
                { queryKey: socialPostQueryKeys.lists() },
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        items: old.items.map((post) =>
                            post.id === id ? { ...post, approvalStatus: 'APPROVED' as const } : post
                        )
                    };
                }
            );

            return { previousData };
        },

        onError: (_err, _id, context) => {
            // Roll back to the snapshots captured in onMutate.
            if (context?.previousData) {
                for (const [queryKey, data] of context.previousData) {
                    queryClient.setQueryData(queryKey, data);
                }
            }
        },

        onSettled: (_data, _error, id) => {
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.detail(id) });
        }
    });
}

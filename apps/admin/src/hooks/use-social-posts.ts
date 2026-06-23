/**
 * @file use-social-posts.ts
 * @description TanStack Query hooks for the admin social posts list and detail pages (SPEC-254 T-039/T-040).
 *
 * Mirrors the structure of use-comment-moderation.ts: a query-key factory,
 * typed response shapes, API helper functions, and named export hooks.
 * Includes an optimistic approve mutation with rollback on error.
 * Extended in T-040: detail query, state-transition mutations, promote-hashtag mutation.
 */

import { fetchApi } from '@/lib/api/client';
import type { SocialPostDetail } from '@repo/service-core';
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
    detail: (id: string) => [...socialPostQueryKeys.all, 'detail', id] as const,
    dashboard: () => [...socialPostQueryKeys.all, 'dashboard'] as const
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

/** Wrapper shape returned by the detail endpoint. */
interface SocialPostDetailResponse {
    readonly success: boolean;
    readonly data: SocialPostDetail;
}

/** Wrapper shape for state-transition endpoints that return id+status+approvalStatus. */
interface TransitionApprovalResponse {
    readonly success: boolean;
    readonly data: {
        readonly id: string;
        readonly status: string;
        readonly approvalStatus: string;
    };
}

/** Wrapper shape for schedule transition (returns scheduledAt). */
interface TransitionScheduleResponse {
    readonly success: boolean;
    readonly data: {
        readonly id: string;
        readonly status: string;
        readonly scheduledAt: string | null;
    };
}

/** Wrapper shape for status-only transitions (mark-ready, archive). */
interface TransitionStatusResponse {
    readonly success: boolean;
    readonly data: {
        readonly id: string;
        readonly status: string;
    };
}

/** Wrapper shape for pause/unpause transitions. */
interface TransitionPauseResponse {
    readonly success: boolean;
    readonly data: {
        readonly id: string;
        readonly paused: boolean;
    };
}

/** Wrapper shape for promote-hashtag. */
interface PromoteHashtagApiResponse {
    readonly success: boolean;
    readonly data: {
        readonly hashtagId: string;
        readonly hashtag: string;
        readonly isNew: boolean;
        readonly warnings?: ReadonlyArray<{ field: string; message: string }>;
    };
}

/** Input for the reject mutation. */
export interface RejectMutationInput {
    readonly id: string;
    readonly reason: string;
}

/** Input for the request-changes mutation. */
export interface RequestChangesMutationInput {
    readonly id: string;
    readonly feedback: string;
}

/** Input for the schedule mutation. */
export interface ScheduleMutationInput {
    readonly id: string;
    readonly scheduledAt: string;
    readonly timezone: string;
}

/** Input for the promote-hashtag mutation. */
export interface PromoteHashtagMutationInput {
    readonly postId: string;
    readonly hashtag: string;
    readonly category: string;
    readonly platform?: string;
    readonly audienceId?: string;
    readonly priority?: number;
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

async function fetchSocialPostDetail(id: string): Promise<SocialPostDetail> {
    const result = await fetchApi<SocialPostDetailResponse>({
        path: `/api/v1/admin/social/posts/${id}`
    });
    return result.data.data;
}

async function approveSocialPostRequest(id: string): Promise<ApproveSocialPostResponse['data']> {
    const result = await fetchApi<ApproveSocialPostResponse>({
        path: `/api/v1/admin/social/posts/${id}/approve`,
        method: 'POST'
    });
    return result.data.data;
}

async function rejectSocialPostRequest(
    input: RejectMutationInput
): Promise<TransitionApprovalResponse['data']> {
    const result = await fetchApi<TransitionApprovalResponse>({
        path: `/api/v1/admin/social/posts/${input.id}/reject`,
        method: 'POST',
        body: { reason: input.reason }
    });
    return result.data.data;
}

async function requestChangesSocialPostRequest(
    input: RequestChangesMutationInput
): Promise<TransitionApprovalResponse['data']> {
    const result = await fetchApi<TransitionApprovalResponse>({
        path: `/api/v1/admin/social/posts/${input.id}/request-changes`,
        method: 'POST',
        body: { feedback: input.feedback }
    });
    return result.data.data;
}

async function scheduleSocialPostRequest(
    input: ScheduleMutationInput
): Promise<TransitionScheduleResponse['data']> {
    const result = await fetchApi<TransitionScheduleResponse>({
        path: `/api/v1/admin/social/posts/${input.id}/schedule`,
        method: 'POST',
        body: { scheduledAt: input.scheduledAt, timezone: input.timezone }
    });
    return result.data.data;
}

async function markReadySocialPostRequest(id: string): Promise<TransitionStatusResponse['data']> {
    const result = await fetchApi<TransitionStatusResponse>({
        path: `/api/v1/admin/social/posts/${id}/mark-ready`,
        method: 'POST'
    });
    return result.data.data;
}

async function pauseSocialPostRequest(id: string): Promise<TransitionPauseResponse['data']> {
    const result = await fetchApi<TransitionPauseResponse>({
        path: `/api/v1/admin/social/posts/${id}/pause`,
        method: 'POST'
    });
    return result.data.data;
}

async function unpauseSocialPostRequest(id: string): Promise<TransitionPauseResponse['data']> {
    const result = await fetchApi<TransitionPauseResponse>({
        path: `/api/v1/admin/social/posts/${id}/unpause`,
        method: 'POST'
    });
    return result.data.data;
}

async function archiveSocialPostRequest(id: string): Promise<TransitionStatusResponse['data']> {
    const result = await fetchApi<TransitionStatusResponse>({
        path: `/api/v1/admin/social/posts/${id}/archive`,
        method: 'POST'
    });
    return result.data.data;
}

async function promoteHashtagRequest(
    input: PromoteHashtagMutationInput
): Promise<PromoteHashtagApiResponse['data']> {
    const result = await fetchApi<PromoteHashtagApiResponse>({
        path: `/api/v1/admin/social/posts/${input.postId}/promote-hashtag`,
        method: 'POST',
        body: {
            hashtag: input.hashtag,
            category: input.category,
            platform: input.platform,
            audienceId: input.audienceId,
            priority: input.priority
        }
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

/**
 * Fetches the full detail for a single social post, including targets, media,
 * hashtags, and publish logs.
 *
 * Gate: caller must have SOCIAL_POST_VIEW (enforced server-side).
 *
 * @param id - Post UUID
 */
export function useSocialPostDetail(id: string) {
    return useQuery({
        queryKey: socialPostQueryKeys.detail(id),
        queryFn: () => fetchSocialPostDetail(id),
        staleTime: 30_000,
        enabled: id.length > 0
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

/**
 * Mutation: reject a social post.
 * Invalidates both the list and the detail on settle.
 */
export function useRejectSocialPost() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: RejectMutationInput) => rejectSocialPostRequest(input),
        onSettled: (_data, _error, input) => {
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.detail(input.id) });
        }
    });
}

/**
 * Mutation: request changes on a social post.
 * Invalidates both the list and the detail on settle.
 */
export function useRequestChangesSocialPost() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: RequestChangesMutationInput) => requestChangesSocialPostRequest(input),
        onSettled: (_data, _error, input) => {
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.detail(input.id) });
        }
    });
}

/**
 * Mutation: schedule a social post for future publication.
 * Invalidates both the list and the detail on settle.
 */
export function useScheduleSocialPost() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: ScheduleMutationInput) => scheduleSocialPostRequest(input),
        onSettled: (_data, _error, input) => {
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.detail(input.id) });
        }
    });
}

/**
 * Mutation: mark a social post as READY_TO_PUBLISH.
 * Invalidates both the list and the detail on settle.
 */
export function useMarkReadySocialPost() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => markReadySocialPostRequest(id),
        onSettled: (_data, _error, id) => {
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.detail(id) });
        }
    });
}

/**
 * Mutation: pause a social post.
 * Invalidates both the list and the detail on settle.
 */
export function usePauseSocialPost() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => pauseSocialPostRequest(id),
        onSettled: (_data, _error, id) => {
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.detail(id) });
        }
    });
}

/**
 * Mutation: unpause a social post.
 * Invalidates both the list and the detail on settle.
 */
export function useUnpauseSocialPost() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => unpauseSocialPostRequest(id),
        onSettled: (_data, _error, id) => {
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.detail(id) });
        }
    });
}

/**
 * Mutation: archive a social post (soft-delete).
 * Invalidates both the list and the detail on settle.
 */
export function useArchiveSocialPost() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => archiveSocialPostRequest(id),
        onSettled: (_data, _error, id) => {
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.detail(id) });
        }
    });
}

/**
 * Mutation: promote a free-text hashtag to the managed catalog.
 *
 * The API always returns HTTP 201. Use `data.isNew` to distinguish
 * creation (true) from reuse of an existing catalog entry (false).
 * Invalidates the detail query on settle so the hashtag list refreshes.
 */
export function usePromoteHashtag() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: PromoteHashtagMutationInput) => promoteHashtagRequest(input),
        onSettled: (_data, _error, input) => {
            queryClient.invalidateQueries({
                queryKey: socialPostQueryKeys.detail(input.postId)
            });
        }
    });
}

// ---------------------------------------------------------------------------
// Dashboard hook — defined in use-social-dashboard.ts, re-exported here for
// a single import surface.
// ---------------------------------------------------------------------------
export { useSocialDashboard } from './use-social-dashboard';

async function deleteSocialPostRequest(id: string): Promise<TransitionStatusResponse['data']> {
    // The social post domain uses archive (soft-delete) as the delete mechanism.
    // There is no hard-delete endpoint — archive is the authoritative removal path.
    const result = await fetchApi<TransitionStatusResponse>({
        path: `/api/v1/admin/social/posts/${id}/archive`,
        method: 'POST'
    });
    return result.data.data;
}

/**
 * Mutation: delete (archive) a social post.
 *
 * Soft-deletes the post by calling the archive endpoint.
 * On settle: removes the detail cache entry and invalidates all list caches
 * so the list page reflects the removal on the next render.
 *
 * Gate: caller must have SOCIAL_POST_ARCHIVE (enforced server-side).
 *
 * @param id - Post UUID
 */
export function useDeleteSocialPost() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteSocialPostRequest(id),
        onSettled: (_data, _error, id) => {
            queryClient.removeQueries({ queryKey: socialPostQueryKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: socialPostQueryKeys.lists() });
        }
    });
}

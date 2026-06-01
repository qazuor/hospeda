/**
 * @file use-comment-moderation.ts
 * @description TanStack Query hooks for the admin comment moderation queue (SPEC-165 T-017 / T-018).
 *
 * Mirrors the structure of use-user-tag-moderation.ts exactly: a query-key
 * factory, typed response shapes, API helper functions, and named export hooks.
 */

import { fetchApi } from '@/lib/api/client';
import type { EntityCommentAdminItem } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Query key factory for comment moderation queries.
 * All list keys share the same root so `invalidateQueries` on `lists()` busts
 * all list variants in one call.
 */
export const commentModerationQueryKeys = {
    all: ['comments-moderation'] as const,
    lists: () => [...commentModerationQueryKeys.all, 'list'] as const,
    list: (filters: CommentModerationListFilters) =>
        [...commentModerationQueryKeys.lists(), filters] as const,
    detail: (id: string) => [...commentModerationQueryKeys.all, 'detail', id] as const
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

/** Wrapper shape returned by the API for the admin comment list endpoint. */
interface CommentModerationListResponse {
    readonly success: boolean;
    readonly data: {
        readonly items: EntityCommentAdminItem[];
        readonly pagination: PaginationMeta;
    };
}

/** Wrapper shape returned by the API for the admin comment detail endpoint. */
interface CommentModerationDetailResponse {
    readonly success: boolean;
    readonly data: EntityCommentAdminItem | null;
}

/** Wrapper shape returned by moderation PATCH endpoint. */
interface ModerateCommentResponse {
    readonly success: boolean;
    readonly data: EntityCommentAdminItem;
}

/** Wrapper shape returned by soft-delete endpoint. */
interface SoftDeleteCommentResponse {
    readonly success: boolean;
    readonly data: { readonly deleted: boolean; readonly id: string };
}

/** Wrapper shape returned by hard-delete endpoint. */
interface HardDeleteCommentResponse {
    readonly success: boolean;
    readonly data: { readonly success: boolean };
}

/** Wrapper shape returned by restore endpoint. */
interface RestoreCommentResponse {
    readonly success: boolean;
    readonly data: { readonly success: boolean };
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

/**
 * Filters accepted by the admin comment list endpoint.
 * Maps to the query params documented in SPEC-165 §5.4.
 */
export interface CommentModerationListFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly entityType?: 'POST' | 'EVENT';
    readonly moderationState?: 'APPROVED' | 'REJECTED' | 'PENDING';
    readonly entityId?: string;
    readonly authorId?: string;
    readonly search?: string;
    readonly includeDeleted?: boolean;
    readonly sort?: string;
}

// ---------------------------------------------------------------------------
// API helper functions
// ---------------------------------------------------------------------------

async function fetchCommentsList(
    filters: CommentModerationListFilters
): Promise<CommentModerationListResponse['data']> {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters.entityType) params.set('entityType', filters.entityType);
    if (filters.moderationState) params.set('moderationState', filters.moderationState);
    if (filters.entityId) params.set('entityId', filters.entityId);
    if (filters.authorId) params.set('authorId', filters.authorId);
    if (filters.search) params.set('search', filters.search);
    if (filters.includeDeleted !== undefined)
        params.set('includeDeleted', String(filters.includeDeleted));
    if (filters.sort) params.set('sort', filters.sort);

    const query = params.toString();
    const path = `/api/v1/admin/comments${query ? `?${query}` : ''}`;

    const result = await fetchApi<CommentModerationListResponse>({ path });
    return result.data.data;
}

async function fetchCommentById(id: string): Promise<EntityCommentAdminItem | null> {
    const result = await fetchApi<CommentModerationDetailResponse>({
        path: `/api/v1/admin/comments/${id}`
    });
    return result.data.data;
}

async function moderateCommentRequest(
    id: string,
    moderationState: 'APPROVED' | 'REJECTED'
): Promise<EntityCommentAdminItem> {
    const result = await fetchApi<ModerateCommentResponse>({
        path: `/api/v1/admin/comments/${id}/moderation`,
        method: 'PATCH',
        body: { moderationState }
    });
    return result.data.data;
}

async function softDeleteCommentRequest(id: string): Promise<SoftDeleteCommentResponse['data']> {
    const result = await fetchApi<SoftDeleteCommentResponse>({
        path: `/api/v1/admin/comments/${id}`,
        method: 'DELETE'
    });
    return result.data.data;
}

async function hardDeleteCommentRequest(id: string): Promise<HardDeleteCommentResponse['data']> {
    const result = await fetchApi<HardDeleteCommentResponse>({
        path: `/api/v1/admin/comments/${id}/hard`,
        method: 'DELETE'
    });
    return result.data.data;
}

async function restoreCommentRequest(id: string): Promise<RestoreCommentResponse['data']> {
    const result = await fetchApi<RestoreCommentResponse>({
        path: `/api/v1/admin/comments/${id}/restore`,
        method: 'POST'
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the paginated, filterable list of comments for admin moderation.
 *
 * Gate: caller must have POST_COMMENT_VIEW or EVENT_COMMENT_VIEW (enforced
 * server-side by the service).
 *
 * @param filters - Pagination and filter parameters
 */
export function useCommentsList(filters: CommentModerationListFilters = {}) {
    return useQuery({
        queryKey: commentModerationQueryKeys.list(filters),
        queryFn: () => fetchCommentsList(filters),
        staleTime: 30_000
    });
}

/**
 * Fetches a single comment by ID for the detail panel.
 *
 * @param id - The comment UUID
 */
export function useComment(id: string) {
    return useQuery({
        queryKey: commentModerationQueryKeys.detail(id),
        queryFn: () => fetchCommentById(id),
        staleTime: 30_000,
        enabled: !!id
    });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Mutation to set a comment's moderationState (APPROVED or REJECTED).
 * Invalidates the comment list cache on success (AC-34).
 */
export function useModerateComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            id,
            moderationState
        }: { id: string; moderationState: 'APPROVED' | 'REJECTED' }) =>
            moderateCommentRequest(id, moderationState),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: commentModerationQueryKeys.lists() });
            queryClient.invalidateQueries({
                queryKey: commentModerationQueryKeys.detail(variables.id)
            });
        }
    });
}

/**
 * Mutation for soft-deleting any comment (admin moderation action).
 * Invalidates the comment list cache on success.
 */
export function useSoftDeleteComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => softDeleteCommentRequest(id),
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: commentModerationQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: commentModerationQueryKeys.detail(id) });
        }
    });
}

/**
 * Mutation for hard-deleting a comment permanently.
 * Requires POST_COMMENT_MODERATE or EVENT_COMMENT_MODERATE (enforced server-side).
 * Invalidates the comment list cache on success.
 */
export function useHardDeleteComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => hardDeleteCommentRequest(id),
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: commentModerationQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: commentModerationQueryKeys.detail(id) });
        }
    });
}

/**
 * Mutation for restoring a soft-deleted comment.
 * Invalidates the comment list cache on success.
 */
export function useRestoreComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => restoreCommentRequest(id),
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: commentModerationQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: commentModerationQueryKeys.detail(id) });
        }
    });
}

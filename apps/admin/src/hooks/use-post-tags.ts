import { fetchApi } from '@/lib/api/client';
import type { CreatePostTagInput, PostTag, UpdatePostTagInput } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Query key factory for PostTag queries.
 * Provides a consistent key structure for TanStack Query cache management.
 */
export const postTagQueryKeys = {
    all: ['post-tags'] as const,
    lists: () => [...postTagQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...postTagQueryKeys.lists(), filters] as const,
    details: () => [...postTagQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...postTagQueryKeys.details(), id] as const,
    impact: (id: string) => [...postTagQueryKeys.all, 'impact', id] as const
};

/** Shape of the paginated list API response for PostTags. */
interface PostTagListResponse {
    readonly success: boolean;
    readonly data: {
        readonly items: PostTag[];
        readonly pagination: {
            readonly page: number;
            readonly pageSize: number;
            readonly total: number;
            readonly totalPages: number;
        };
    };
}

/** Shape of the single-item API response for PostTags. */
interface PostTagItemResponse {
    readonly success: boolean;
    readonly data: PostTag;
}

/** Shape of the impact count API response. */
interface PostTagImpactResponse {
    readonly success: boolean;
    readonly data: {
        readonly count: number;
    };
}

/** Filters accepted by the PostTag list endpoint. */
export interface PostTagListFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly search?: string;
    readonly lifecycleState?: string;
    readonly color?: string;
    readonly name?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchPostTagsList(filters: PostTagListFilters) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    // Map name → search and lifecycleState → status to the canonical admin
    // search params (TagAdminSearchSchema → AdminSearchBaseSchema).
    const searchValue = filters.search ?? filters.name;
    if (searchValue) params.set('search', searchValue);
    if (filters.lifecycleState) params.set('status', filters.lifecycleState);
    if (filters.color) params.set('color', filters.color);

    const query = params.toString();
    const path = `/api/v1/admin/posts/tags${query ? `?${query}` : ''}`;

    const result = await fetchApi<PostTagListResponse>({ path });
    return result.data;
}

async function fetchPostTag(id: string) {
    const result = await fetchApi<PostTagItemResponse>({
        path: `/api/v1/admin/posts/tags/${id}`
    });
    return result.data.data;
}

async function fetchPostTagImpact(id: string) {
    const result = await fetchApi<PostTagImpactResponse>({
        path: `/api/v1/admin/posts/tags/${id}/impact`
    });
    return result.data.data;
}

async function createPostTagRequest(data: CreatePostTagInput) {
    const result = await fetchApi<PostTagItemResponse>({
        path: '/api/v1/admin/posts/tags',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

async function updatePostTagRequest(id: string, data: UpdatePostTagInput) {
    const result = await fetchApi<PostTagItemResponse>({
        path: `/api/v1/admin/posts/tags/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

async function deletePostTagRequest(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/posts/tags/${id}`,
        method: 'DELETE'
    });
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the paginated list of PostTags with optional filters.
 *
 * @param filters - Pagination and filter parameters
 */
export function usePostTagsList(filters: PostTagListFilters = {}) {
    return useQuery({
        queryKey: postTagQueryKeys.list(filters as Record<string, unknown>),
        queryFn: () => fetchPostTagsList(filters),
        staleTime: 30_000
    });
}

/**
 * Fetches a single PostTag by ID.
 *
 * @param id - PostTag UUID
 */
export function usePostTag(id: string) {
    return useQuery({
        queryKey: postTagQueryKeys.detail(id),
        queryFn: () => fetchPostTag(id),
        enabled: !!id,
        staleTime: 30_000
    });
}

/**
 * Fetches the impact count for a PostTag (number of posts using it).
 * Used before confirming deletion. Lazy by default — only runs when `enabled` is true.
 *
 * @param id - PostTag UUID
 * @param enabled - Whether to execute the query (default false)
 */
export function usePostTagImpact(id: string, enabled = false) {
    return useQuery({
        queryKey: postTagQueryKeys.impact(id),
        queryFn: () => fetchPostTagImpact(id),
        enabled: !!id && enabled,
        staleTime: 0 // Always fresh for delete confirmation
    });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Mutation for creating a new PostTag.
 * Invalidates the list cache on success.
 */
export function useCreatePostTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreatePostTagInput) => createPostTagRequest(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: postTagQueryKeys.lists() });
        }
    });
}

/**
 * Mutation for updating an existing PostTag.
 * Updates the detail cache and invalidates list cache on success.
 *
 * @param id - PostTag UUID to update
 */
export function useUpdatePostTag(id: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: UpdatePostTagInput) => updatePostTagRequest(id, data),
        onSuccess: (updated) => {
            queryClient.setQueryData(postTagQueryKeys.detail(id), updated);
            queryClient.invalidateQueries({ queryKey: postTagQueryKeys.lists() });
        }
    });
}

/**
 * Mutation for hard-deleting a PostTag.
 * Removes from detail cache and invalidates list cache on success.
 */
export function useDeletePostTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deletePostTagRequest(id),
        onSuccess: (_data, id) => {
            queryClient.removeQueries({ queryKey: postTagQueryKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: postTagQueryKeys.lists() });
        }
    });
}

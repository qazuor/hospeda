import { fetchApi } from '@/lib/api/client';
import type { Tag, TagCreateInput, TagUpdateInput } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Query key factory for own USER tag queries.
 * Provides a consistent key structure for TanStack Query cache management.
 */
export const ownTagQueryKeys = {
    all: ['own-tags'] as const,
    lists: () => [...ownTagQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...ownTagQueryKeys.lists(), filters] as const,
    details: () => [...ownTagQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...ownTagQueryKeys.details(), id] as const,
    impact: (id: string) => [...ownTagQueryKeys.all, 'impact', id] as const,
    quota: () => [...ownTagQueryKeys.all, 'quota'] as const
};

/** Shape of the paginated list API response for own USER tags. */
interface OwnTagListResponse {
    readonly success: boolean;
    readonly data: {
        readonly items: Tag[];
        readonly pagination: {
            readonly page: number;
            readonly pageSize: number;
            readonly total: number;
            readonly totalPages: number;
        };
    };
}

/** Shape of the single-item API response for own USER tags. */
interface OwnTagItemResponse {
    readonly success: boolean;
    readonly data: Tag;
}

/** Shape of the impact count API response. */
interface OwnTagImpactResponse {
    readonly success: boolean;
    readonly data: {
        readonly count: number;
    };
}

/** Shape of the quota API response. */
interface OwnTagQuotaResponse {
    readonly success: boolean;
    readonly data: {
        readonly used: number;
        readonly limit: number;
    };
}

/** Filters accepted by the own USER tag list endpoint. */
export interface OwnTagListFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly search?: string;
    readonly lifecycleState?: string;
    readonly color?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchOwnTagsList(filters: OwnTagListFilters) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters.search) params.set('search', filters.search);
    if (filters.lifecycleState) params.set('lifecycleState', filters.lifecycleState);
    if (filters.color) params.set('color', filters.color);

    const query = params.toString();
    const path = `/api/v1/admin/tags/own${query ? `?${query}` : ''}`;

    const result = await fetchApi<OwnTagListResponse>({ path });
    return result.data;
}

async function fetchOwnTag(id: string) {
    const result = await fetchApi<OwnTagItemResponse>({
        path: `/api/v1/admin/tags/own/${id}`
    });
    return result.data.data;
}

async function fetchOwnTagImpact(id: string) {
    const result = await fetchApi<OwnTagImpactResponse>({
        path: `/api/v1/admin/tags/own/${id}/impact`
    });
    return result.data.data;
}

async function fetchOwnTagQuota() {
    const result = await fetchApi<OwnTagQuotaResponse>({
        path: '/api/v1/admin/tags/own/quota'
    });
    return result.data.data;
}

async function createOwnTagRequest(data: Omit<TagCreateInput, 'type' | 'ownerId'>) {
    const result = await fetchApi<OwnTagItemResponse>({
        path: '/api/v1/admin/tags/own',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

async function updateOwnTagRequest(id: string, data: TagUpdateInput) {
    const result = await fetchApi<OwnTagItemResponse>({
        path: `/api/v1/admin/tags/own/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

async function deleteOwnTagRequest(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/tags/own/${id}`,
        method: 'DELETE'
    });
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the paginated list of own USER tags with optional filters.
 * Shows ACTIVE, INACTIVE and ARCHIVED tags (D-022).
 *
 * @param filters - Pagination and filter parameters
 */
export function useOwnTags(filters: OwnTagListFilters = {}) {
    return useQuery({
        queryKey: ownTagQueryKeys.list(filters as Record<string, unknown>),
        queryFn: () => fetchOwnTagsList(filters),
        staleTime: 30_000
    });
}

/**
 * Fetches a single own USER tag by ID.
 *
 * @param id - Tag UUID
 */
export function useOwnTag(id: string) {
    return useQuery({
        queryKey: ownTagQueryKeys.detail(id),
        queryFn: () => fetchOwnTag(id),
        enabled: !!id,
        staleTime: 30_000
    });
}

/**
 * Fetches the impact count for an own USER tag (number of entities using it).
 * Used before confirming deletion. Lazy by default — only runs when `enabled` is true.
 *
 * @param id - Tag UUID
 * @param enabled - Whether to execute the query (default false)
 */
export function useOwnTagImpact(id: string, enabled = false) {
    return useQuery({
        queryKey: ownTagQueryKeys.impact(id),
        queryFn: () => fetchOwnTagImpact(id),
        enabled: !!id && enabled,
        staleTime: 0 // Always fresh for delete confirmation
    });
}

/**
 * Fetches the quota indicator for the authenticated user's own USER tags.
 * Returns `{ used, limit }` to render the quota progress bar.
 */
export function useOwnTagQuota() {
    return useQuery({
        queryKey: ownTagQueryKeys.quota(),
        queryFn: fetchOwnTagQuota,
        staleTime: 60_000
    });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Mutation for creating a new own USER tag.
 * The API injects `type=USER` and `ownerId` from the session on the server.
 * Invalidates the list and quota caches on success.
 */
export function useCreateOwnTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Omit<TagCreateInput, 'type' | 'ownerId'>) => createOwnTagRequest(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ownTagQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ownTagQueryKeys.quota() });
        }
    });
}

/**
 * Mutation for updating an existing own USER tag.
 * Updates the detail cache and invalidates list cache on success.
 *
 * @param id - Tag UUID to update
 */
export function useUpdateOwnTag(id: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: TagUpdateInput) => updateOwnTagRequest(id, data),
        onSuccess: (updated) => {
            queryClient.setQueryData(ownTagQueryKeys.detail(id), updated);
            queryClient.invalidateQueries({ queryKey: ownTagQueryKeys.lists() });
        }
    });
}

/**
 * Mutation for hard-deleting an own USER tag.
 * Removes from detail cache, invalidates list and quota caches on success.
 */
export function useDeleteOwnTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteOwnTagRequest(id),
        onSuccess: (_data, id) => {
            queryClient.removeQueries({ queryKey: ownTagQueryKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: ownTagQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ownTagQueryKeys.quota() });
        }
    });
}

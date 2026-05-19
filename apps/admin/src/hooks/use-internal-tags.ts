import { fetchApi } from '@/lib/api/client';
import { TagTypeEnum } from '@repo/schemas';
import type { Tag, TagCreateInput, TagUpdateInput } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Query key factory for INTERNAL tag queries.
 * Provides a consistent key structure for TanStack Query cache management.
 */
export const internalTagQueryKeys = {
    all: ['internal-tags'] as const,
    lists: () => [...internalTagQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...internalTagQueryKeys.lists(), filters] as const,
    details: () => [...internalTagQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...internalTagQueryKeys.details(), id] as const,
    impact: (id: string) => [...internalTagQueryKeys.all, 'impact', id] as const
};

/** Shape of the paginated list API response for INTERNAL tags. */
interface InternalTagListResponse {
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

/** Shape of the single-item API response for INTERNAL tags. */
interface InternalTagItemResponse {
    readonly success: boolean;
    readonly data: Tag;
}

/** Shape of the impact count API response. */
interface InternalTagImpactResponse {
    readonly success: boolean;
    readonly data: {
        readonly count: number;
    };
}

/** Filters accepted by the INTERNAL tag list endpoint. */
export interface InternalTagListFilters {
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

async function fetchInternalTagsList(filters: InternalTagListFilters) {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    // Map name → search and lifecycleState → status to the canonical admin
    // search params. TagAdminSearchSchema (extends AdminSearchBaseSchema)
    // accepts search/status, not name/lifecycleState.
    const searchValue = filters.search ?? filters.name;
    if (searchValue) params.set('search', searchValue);
    if (filters.lifecycleState) params.set('status', filters.lifecycleState);
    if (filters.color) params.set('color', filters.color);

    const query = params.toString();
    const path = `/api/v1/admin/tags/internal${query ? `?${query}` : ''}`;

    const result = await fetchApi<InternalTagListResponse>({ path });
    return result.data;
}

async function fetchInternalTag(id: string) {
    const result = await fetchApi<InternalTagItemResponse>({
        path: `/api/v1/admin/tags/internal/${id}`
    });
    return result.data.data;
}

async function fetchInternalTagImpact(id: string) {
    const result = await fetchApi<InternalTagImpactResponse>({
        path: `/api/v1/admin/tags/internal/${id}/impact`
    });
    return result.data.data;
}

async function createInternalTagRequest(data: TagCreateInput) {
    const result = await fetchApi<InternalTagItemResponse>({
        path: '/api/v1/admin/tags/internal',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

async function updateInternalTagRequest(id: string, data: TagUpdateInput) {
    const result = await fetchApi<InternalTagItemResponse>({
        path: `/api/v1/admin/tags/internal/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

async function deleteInternalTagRequest(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/tags/internal/${id}`,
        method: 'DELETE'
    });
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the paginated list of INTERNAL tags with optional filters.
 *
 * Gate: caller must have `TAG_INTERNAL_VIEW` permission.
 *
 * @param filters - Pagination and filter parameters
 */
export function useInternalTagsList(filters: InternalTagListFilters = {}) {
    return useQuery({
        queryKey: internalTagQueryKeys.list(filters as Record<string, unknown>),
        queryFn: () => fetchInternalTagsList(filters),
        staleTime: 30_000
    });
}

/**
 * Fetches a single INTERNAL tag by ID.
 *
 * @param id - Tag UUID
 */
export function useInternalTag(id: string) {
    return useQuery({
        queryKey: internalTagQueryKeys.detail(id),
        queryFn: () => fetchInternalTag(id),
        enabled: !!id,
        staleTime: 30_000
    });
}

/**
 * Fetches the impact count for an INTERNAL tag (number of entities using it).
 * Used before confirming deletion. Lazy by default — only runs when `enabled` is true.
 *
 * @param id - Tag UUID
 * @param enabled - Whether to execute the query (default false)
 */
export function useInternalTagImpact(id: string, enabled = false) {
    return useQuery({
        queryKey: internalTagQueryKeys.impact(id),
        queryFn: () => fetchInternalTagImpact(id),
        enabled: !!id && enabled,
        staleTime: 0 // Always fresh for delete confirmation
    });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Mutation for creating a new INTERNAL tag.
 * Injects `type: 'INTERNAL'` automatically.
 * Invalidates the list cache on success.
 */
export function useCreateInternalTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Omit<TagCreateInput, 'type'>) =>
            createInternalTagRequest({ ...data, type: TagTypeEnum.INTERNAL }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: internalTagQueryKeys.lists() });
        }
    });
}

/**
 * Mutation for updating an existing INTERNAL tag.
 * Updates the detail cache and invalidates list cache on success.
 *
 * @param id - Tag UUID to update
 */
export function useUpdateInternalTag(id: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: TagUpdateInput) => updateInternalTagRequest(id, data),
        onSuccess: (updated) => {
            queryClient.setQueryData(internalTagQueryKeys.detail(id), updated);
            queryClient.invalidateQueries({ queryKey: internalTagQueryKeys.lists() });
        }
    });
}

/**
 * Mutation for hard-deleting an INTERNAL tag.
 * Removes from detail cache and invalidates list cache on success.
 */
export function useDeleteInternalTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteInternalTagRequest(id),
        onSuccess: (_data, id) => {
            queryClient.removeQueries({ queryKey: internalTagQueryKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: internalTagQueryKeys.lists() });
        }
    });
}

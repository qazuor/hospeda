import { fetchApi } from '@/lib/api/client';
import { TagTypeEnum } from '@repo/schemas';
import type { Tag, TagCreateInput, TagUpdateInput } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Query key factory for SYSTEM tag queries.
 * Provides a consistent key structure for TanStack Query cache management.
 */
export const systemTagQueryKeys = {
    all: ['system-tags'] as const,
    lists: () => [...systemTagQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...systemTagQueryKeys.lists(), filters] as const,
    details: () => [...systemTagQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...systemTagQueryKeys.details(), id] as const,
    impact: (id: string) => [...systemTagQueryKeys.all, 'impact', id] as const
};

/** Shape of the paginated list API response for SYSTEM tags. */
interface SystemTagListResponse {
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

/** Shape of the single-item API response for SYSTEM tags. */
interface SystemTagItemResponse {
    readonly success: boolean;
    readonly data: Tag;
}

/** Shape of the impact count API response. */
interface SystemTagImpactResponse {
    readonly success: boolean;
    readonly data: {
        readonly count: number;
    };
}

/** Filters accepted by the SYSTEM tag list endpoint. */
export interface SystemTagListFilters {
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

async function fetchSystemTagsList(filters: SystemTagListFilters) {
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
    const path = `/api/v1/admin/tags/system${query ? `?${query}` : ''}`;

    const result = await fetchApi<SystemTagListResponse>({ path });
    return result.data;
}

async function fetchSystemTag(id: string) {
    const result = await fetchApi<SystemTagItemResponse>({
        path: `/api/v1/admin/tags/system/${id}`
    });
    return result.data.data;
}

async function fetchSystemTagImpact(id: string) {
    const result = await fetchApi<SystemTagImpactResponse>({
        path: `/api/v1/admin/tags/system/${id}/impact`
    });
    return result.data.data;
}

async function createSystemTagRequest(data: TagCreateInput) {
    const result = await fetchApi<SystemTagItemResponse>({
        path: '/api/v1/admin/tags/system',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

async function updateSystemTagRequest(id: string, data: TagUpdateInput) {
    const result = await fetchApi<SystemTagItemResponse>({
        path: `/api/v1/admin/tags/system/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

async function deleteSystemTagRequest(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/tags/system/${id}`,
        method: 'DELETE'
    });
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the paginated list of SYSTEM tags with optional filters.
 *
 * @param filters - Pagination and filter parameters
 */
export function useSystemTagsList(filters: SystemTagListFilters = {}) {
    return useQuery({
        queryKey: systemTagQueryKeys.list(filters as Record<string, unknown>),
        queryFn: () => fetchSystemTagsList(filters),
        staleTime: 30_000
    });
}

/**
 * Fetches a single SYSTEM tag by ID.
 *
 * @param id - Tag UUID
 */
export function useSystemTag(id: string) {
    return useQuery({
        queryKey: systemTagQueryKeys.detail(id),
        queryFn: () => fetchSystemTag(id),
        enabled: !!id,
        staleTime: 30_000
    });
}

/**
 * Fetches the impact count for a SYSTEM tag (number of entities using it).
 * Used before confirming deletion. Lazy by default — only runs when `enabled` is true.
 *
 * @param id - Tag UUID
 * @param enabled - Whether to execute the query (default false)
 */
export function useSystemTagImpact(id: string, enabled = false) {
    return useQuery({
        queryKey: systemTagQueryKeys.impact(id),
        queryFn: () => fetchSystemTagImpact(id),
        enabled: !!id && enabled,
        staleTime: 0 // Always fresh for delete confirmation
    });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Mutation for creating a new SYSTEM tag.
 * Injects `type: 'SYSTEM'` automatically.
 * Invalidates the list cache on success.
 */
export function useCreateSystemTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Omit<TagCreateInput, 'type'>) =>
            createSystemTagRequest({ ...data, type: TagTypeEnum.SYSTEM }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: systemTagQueryKeys.lists() });
        }
    });
}

/**
 * Mutation for updating an existing SYSTEM tag.
 * Updates the detail cache and invalidates list cache on success.
 *
 * @param id - Tag UUID to update
 */
export function useUpdateSystemTag(id: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: TagUpdateInput) => updateSystemTagRequest(id, data),
        onSuccess: (updated) => {
            queryClient.setQueryData(systemTagQueryKeys.detail(id), updated);
            queryClient.invalidateQueries({ queryKey: systemTagQueryKeys.lists() });
        }
    });
}

/**
 * Mutation for hard-deleting a SYSTEM tag.
 * Removes from detail cache and invalidates list cache on success.
 */
export function useDeleteSystemTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteSystemTagRequest(id),
        onSuccess: (_data, id) => {
            queryClient.removeQueries({ queryKey: systemTagQueryKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: systemTagQueryKeys.lists() });
        }
    });
}

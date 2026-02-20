import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchApi } from '@/lib/api/client';

/**
 * Query keys for tag queries
 */
export const tagQueryKeys = {
    all: ['tags'] as const,
    lists: () => [...tagQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...tagQueryKeys.lists(), filters] as const,
    details: () => [...tagQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...tagQueryKeys.details(), id] as const
};

/**
 * Fetch a single tag by ID
 */
async function fetchTag(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/public/tags/${id}`
    });
    return result.data.data;
}

/**
 * Update a tag
 */
async function updateTag(id: string, data: Record<string, unknown>) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/protected/tags/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

/**
 * Create a new tag
 */
async function createTag(data: Record<string, unknown>) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/protected/tags',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

/**
 * Delete a tag (soft delete)
 */
async function deleteTag(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/tags/${id}`,
        method: 'DELETE'
    });
    return true;
}

/**
 * Hook to fetch a single tag
 */
export const useTagQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: tagQueryKeys.detail(id),
        queryFn: () => fetchTag(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
};

/**
 * Hook to update a tag
 */
export const useUpdateTagMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => updateTag(id, data),
        onSuccess: (updatedData) => {
            // Update the cache with new data
            queryClient.setQueryData(tagQueryKeys.detail(id), updatedData);
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: tagQueryKeys.lists() });
        }
    });
};

/**
 * Hook to create a tag
 */
export const useCreateTagMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => createTag(data),
        onSuccess: () => {
            // Invalidate list queries to refetch
            queryClient.invalidateQueries({ queryKey: tagQueryKeys.lists() });
        }
    });
};

/**
 * Hook to delete a tag
 */
export const useDeleteTagMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteTag(id),
        onSuccess: (_data, id) => {
            // Remove from cache
            queryClient.removeQueries({ queryKey: tagQueryKeys.detail(id) });
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: tagQueryKeys.lists() });
        }
    });
};

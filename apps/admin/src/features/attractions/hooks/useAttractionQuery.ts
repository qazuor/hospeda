import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchApi } from '@/lib/api/client';

/**
 * Query keys for attraction queries
 */
export const attractionQueryKeys = {
    all: ['attractions'] as const,
    lists: () => [...attractionQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...attractionQueryKeys.lists(), filters] as const,
    details: () => [...attractionQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...attractionQueryKeys.details(), id] as const
};

/**
 * Fetch a single attraction by ID
 */
async function fetchAttraction(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/public/attractions/${id}`
    });
    return result.data.data;
}

/**
 * Update an attraction
 */
async function updateAttraction(id: string, data: Record<string, unknown>) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/protected/attractions/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

/**
 * Create a new attraction
 */
async function createAttraction(data: Record<string, unknown>) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/protected/attractions',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

/**
 * Delete an attraction (soft delete)
 */
async function deleteAttraction(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/attractions/${id}`,
        method: 'DELETE'
    });
    return true;
}

/**
 * Hook to fetch a single attraction
 */
export const useAttractionQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: attractionQueryKeys.detail(id),
        queryFn: () => fetchAttraction(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
};

/**
 * Hook to update an attraction
 */
export const useUpdateAttractionMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => updateAttraction(id, data),
        onSuccess: (updatedData) => {
            // Update the cache with new data
            queryClient.setQueryData(attractionQueryKeys.detail(id), updatedData);
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: attractionQueryKeys.lists() });
        }
    });
};

/**
 * Hook to create an attraction
 */
export const useCreateAttractionMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => createAttraction(data),
        onSuccess: () => {
            // Invalidate list queries to refetch
            queryClient.invalidateQueries({ queryKey: attractionQueryKeys.lists() });
        }
    });
};

/**
 * Hook to delete an attraction
 */
export const useDeleteAttractionMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteAttraction(id),
        onSuccess: (_data, id) => {
            // Remove from cache
            queryClient.removeQueries({ queryKey: attractionQueryKeys.detail(id) });
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: attractionQueryKeys.lists() });
        }
    });
};

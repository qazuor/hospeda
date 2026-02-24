import type { Feature } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchApi } from '@/lib/api/client';

/**
 * Query keys for feature queries
 */
export const featureQueryKeys = {
    all: ['features'] as const,
    lists: () => [...featureQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...featureQueryKeys.lists(), filters] as const,
    details: () => [...featureQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...featureQueryKeys.details(), id] as const
};

/**
 * Fetch a single feature by ID
 */
async function fetchFeature(id: string) {
    const result = await fetchApi<{ success: boolean; data: Feature }>({
        path: `/api/v1/admin/features/${id}`
    });
    return result.data.data;
}

/**
 * Update a feature
 */
async function updateFeature(id: string, data: Partial<Feature>) {
    const result = await fetchApi<{ success: boolean; data: Feature }>({
        path: `/api/v1/admin/features/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

/**
 * Create a new feature
 */
async function createFeature(data: Partial<Feature>) {
    const result = await fetchApi<{ success: boolean; data: Feature }>({
        path: '/api/v1/admin/features',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

/**
 * Delete a feature (soft delete)
 */
async function deleteFeature(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/features/${id}`,
        method: 'DELETE'
    });
    return true;
}

/**
 * Hook to fetch a single feature
 */
export const useFeatureQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: featureQueryKeys.detail(id),
        queryFn: () => fetchFeature(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
};

/**
 * Hook to update a feature
 */
export const useUpdateFeatureMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Partial<Feature>) => updateFeature(id, data),
        onSuccess: (updatedData) => {
            // Update the cache with new data
            queryClient.setQueryData(featureQueryKeys.detail(id), updatedData);
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: featureQueryKeys.lists() });
        }
    });
};

/**
 * Hook to create a feature
 */
export const useCreateFeatureMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Partial<Feature>) => createFeature(data),
        onSuccess: () => {
            // Invalidate list queries to refetch
            queryClient.invalidateQueries({ queryKey: featureQueryKeys.lists() });
        }
    });
};

/**
 * Hook to delete a feature
 */
export const useDeleteFeatureMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteFeature(id),
        onSuccess: (_data, id) => {
            // Remove from cache
            queryClient.removeQueries({ queryKey: featureQueryKeys.detail(id) });
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: featureQueryKeys.lists() });
        }
    });
};

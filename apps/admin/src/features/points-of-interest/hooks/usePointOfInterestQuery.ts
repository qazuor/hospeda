import type { PointOfInterest } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchApi } from '@/lib/api/client';

/**
 * Query keys for point-of-interest queries
 */
export const pointOfInterestQueryKeys = {
    all: ['points-of-interest'] as const,
    lists: () => [...pointOfInterestQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
        [...pointOfInterestQueryKeys.lists(), filters] as const,
    details: () => [...pointOfInterestQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...pointOfInterestQueryKeys.details(), id] as const
};

/**
 * Fetch a single point of interest by ID
 */
async function fetchPointOfInterest(id: string) {
    const result = await fetchApi<{ success: boolean; data: PointOfInterest }>({
        path: `/api/v1/admin/points-of-interest/${id}`
    });
    return result.data.data;
}

/**
 * Update a point of interest
 */
async function updatePointOfInterest(id: string, data: Partial<PointOfInterest>) {
    const result = await fetchApi<{ success: boolean; data: PointOfInterest }>({
        path: `/api/v1/admin/points-of-interest/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

/**
 * Create a new point of interest
 */
async function createPointOfInterest(data: Partial<PointOfInterest>) {
    const result = await fetchApi<{ success: boolean; data: PointOfInterest }>({
        path: '/api/v1/admin/points-of-interest',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

/**
 * Delete a point of interest (soft delete)
 */
async function deletePointOfInterest(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/points-of-interest/${id}`,
        method: 'DELETE'
    });
    return true;
}

/**
 * Hook to fetch a single point of interest
 */
export const usePointOfInterestQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: pointOfInterestQueryKeys.detail(id),
        queryFn: () => fetchPointOfInterest(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
};

/**
 * Hook to update a point of interest
 */
export const useUpdatePointOfInterestMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Partial<PointOfInterest>) => updatePointOfInterest(id, data),
        onSuccess: (updatedData) => {
            // Update the cache with new data
            queryClient.setQueryData(pointOfInterestQueryKeys.detail(id), updatedData);
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: pointOfInterestQueryKeys.lists() });
        }
    });
};

/**
 * Hook to create a point of interest
 */
export const useCreatePointOfInterestMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Partial<PointOfInterest>) => createPointOfInterest(data),
        onSuccess: () => {
            // Invalidate list queries to refetch
            queryClient.invalidateQueries({ queryKey: pointOfInterestQueryKeys.lists() });
        }
    });
};

/**
 * Hook to delete a point of interest
 */
export const useDeletePointOfInterestMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deletePointOfInterest(id),
        onSuccess: (_data, id) => {
            // Remove from cache
            queryClient.removeQueries({ queryKey: pointOfInterestQueryKeys.detail(id) });
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: pointOfInterestQueryKeys.lists() });
        }
    });
};

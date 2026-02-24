import type { Amenity } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchApi } from '@/lib/api/client';

/**
 * Query keys for amenity queries
 */
export const amenityQueryKeys = {
    all: ['amenities'] as const,
    lists: () => [...amenityQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...amenityQueryKeys.lists(), filters] as const,
    details: () => [...amenityQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...amenityQueryKeys.details(), id] as const
};

/**
 * Fetch a single amenity by ID
 */
async function fetchAmenity(id: string) {
    const result = await fetchApi<{ success: boolean; data: Amenity }>({
        path: `/api/v1/admin/amenities/${id}`
    });
    return result.data.data;
}

/**
 * Update an amenity
 */
async function updateAmenity(id: string, data: Partial<Amenity>) {
    const result = await fetchApi<{ success: boolean; data: Amenity }>({
        path: `/api/v1/admin/amenities/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

/**
 * Create a new amenity
 */
async function createAmenity(data: Partial<Amenity>) {
    const result = await fetchApi<{ success: boolean; data: Amenity }>({
        path: '/api/v1/admin/amenities',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

/**
 * Delete an amenity (soft delete)
 */
async function deleteAmenity(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/amenities/${id}`,
        method: 'DELETE'
    });
    return true;
}

/**
 * Hook to fetch a single amenity
 */
export const useAmenityQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: amenityQueryKeys.detail(id),
        queryFn: () => fetchAmenity(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
};

/**
 * Hook to update an amenity
 */
export const useUpdateAmenityMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Partial<Amenity>) => updateAmenity(id, data),
        onSuccess: (updatedData) => {
            // Update the cache with new data
            queryClient.setQueryData(amenityQueryKeys.detail(id), updatedData);
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: amenityQueryKeys.lists() });
        }
    });
};

/**
 * Hook to create an amenity
 */
export const useCreateAmenityMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Partial<Amenity>) => createAmenity(data),
        onSuccess: () => {
            // Invalidate list queries to refetch
            queryClient.invalidateQueries({ queryKey: amenityQueryKeys.lists() });
        }
    });
};

/**
 * Hook to delete an amenity
 */
export const useDeleteAmenityMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteAmenity(id),
        onSuccess: (_data, id) => {
            // Remove from cache
            queryClient.removeQueries({ queryKey: amenityQueryKeys.detail(id) });
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: amenityQueryKeys.lists() });
        }
    });
};

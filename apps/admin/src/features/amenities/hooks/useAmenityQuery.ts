import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/v1';

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
    const response = await fetch(`${API_BASE}/public/amenities/${id}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch amenity: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update an amenity
 */
async function updateAmenity(id: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/amenities/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update amenity: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Create a new amenity
 */
async function createAmenity(data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/amenities`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to create amenity: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Delete an amenity (soft delete)
 */
async function deleteAmenity(id: string) {
    const response = await fetch(`${API_BASE}/admin/amenities/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to delete amenity: ${response.statusText}`);
    }

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
        mutationFn: (data: Record<string, unknown>) => updateAmenity(id, data),
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
        mutationFn: (data: Record<string, unknown>) => createAmenity(data),
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

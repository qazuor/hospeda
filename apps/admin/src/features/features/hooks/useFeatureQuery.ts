import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/v1';

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
    const response = await fetch(`${API_BASE}/public/features/${id}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch feature: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update a feature
 */
async function updateFeature(id: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/features/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update feature: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Create a new feature
 */
async function createFeature(data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/features`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to create feature: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Delete a feature (soft delete)
 */
async function deleteFeature(id: string) {
    const response = await fetch(`${API_BASE}/admin/features/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to delete feature: ${response.statusText}`);
    }

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
        mutationFn: (data: Record<string, unknown>) => updateFeature(id, data),
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
        mutationFn: (data: Record<string, unknown>) => createFeature(data),
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

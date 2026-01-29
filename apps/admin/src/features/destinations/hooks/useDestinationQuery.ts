import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/v1';

/**
 * Query keys for destination queries
 */
export const destinationQueryKeys = {
    all: ['destinations'] as const,
    lists: () => [...destinationQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...destinationQueryKeys.lists(), filters] as const,
    details: () => [...destinationQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...destinationQueryKeys.details(), id] as const
};

/**
 * Fetch a single destination by ID
 */
async function fetchDestination(id: string) {
    const response = await fetch(`${API_BASE}/public/destinations/${id}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch destination: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update a destination
 */
async function updateDestination(id: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/destinations/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update destination: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Create a new destination
 */
async function createDestination(data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/destinations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to create destination: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Delete a destination (soft delete)
 */
async function deleteDestination(id: string) {
    const response = await fetch(`${API_BASE}/admin/destinations/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to delete destination: ${response.statusText}`);
    }

    return true;
}

/**
 * Hook to fetch a single destination
 */
export const useDestinationQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: destinationQueryKeys.detail(id),
        queryFn: () => fetchDestination(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
};

/**
 * Hook to update a destination
 */
export const useUpdateDestinationMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => updateDestination(id, data),
        onSuccess: (updatedData) => {
            // Update the cache with new data
            queryClient.setQueryData(destinationQueryKeys.detail(id), updatedData);
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: destinationQueryKeys.lists() });
        }
    });
};

/**
 * Hook to create a destination
 */
export const useCreateDestinationMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => createDestination(data),
        onSuccess: () => {
            // Invalidate list queries to refetch
            queryClient.invalidateQueries({ queryKey: destinationQueryKeys.lists() });
        }
    });
};

/**
 * Hook to delete a destination
 */
export const useDeleteDestinationMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteDestination(id),
        onSuccess: (_data, id) => {
            // Remove from cache
            queryClient.removeQueries({ queryKey: destinationQueryKeys.detail(id) });
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: destinationQueryKeys.lists() });
        }
    });
};

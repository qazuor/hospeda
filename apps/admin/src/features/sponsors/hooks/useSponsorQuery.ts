import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/v1';

/**
 * Query keys for sponsor queries
 */
export const sponsorQueryKeys = {
    all: ['sponsors'] as const,
    lists: () => [...sponsorQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...sponsorQueryKeys.lists(), filters] as const,
    details: () => [...sponsorQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...sponsorQueryKeys.details(), id] as const
};

/**
 * Fetch a single sponsor by ID
 */
async function fetchSponsor(id: string) {
    const response = await fetch(`${API_BASE}/public/sponsors/${id}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch sponsor: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update a sponsor
 */
async function updateSponsor(id: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/sponsors/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update sponsor: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Create a new sponsor
 */
async function createSponsor(data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/sponsors`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to create sponsor: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Delete a sponsor (soft delete)
 */
async function deleteSponsor(id: string) {
    const response = await fetch(`${API_BASE}/admin/sponsors/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to delete sponsor: ${response.statusText}`);
    }

    return true;
}

/**
 * Hook to fetch a single sponsor
 */
export const useSponsorQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: sponsorQueryKeys.detail(id),
        queryFn: () => fetchSponsor(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
};

/**
 * Hook to update a sponsor
 */
export const useUpdateSponsorMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => updateSponsor(id, data),
        onSuccess: (updatedData) => {
            // Update the cache with new data
            queryClient.setQueryData(sponsorQueryKeys.detail(id), updatedData);
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: sponsorQueryKeys.lists() });
        }
    });
};

/**
 * Hook to create a sponsor
 */
export const useCreateSponsorMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => createSponsor(data),
        onSuccess: () => {
            // Invalidate list queries to refetch
            queryClient.invalidateQueries({ queryKey: sponsorQueryKeys.lists() });
        }
    });
};

/**
 * Hook to delete a sponsor
 */
export const useDeleteSponsorMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteSponsor(id),
        onSuccess: (_data, id) => {
            // Remove from cache
            queryClient.removeQueries({ queryKey: sponsorQueryKeys.detail(id) });
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: sponsorQueryKeys.lists() });
        }
    });
};

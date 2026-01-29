import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/v1';

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
    const response = await fetch(`${API_BASE}/public/tags/${id}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch tag: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update a tag
 */
async function updateTag(id: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/tags/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update tag: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Create a new tag
 */
async function createTag(data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/tags`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to create tag: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Delete a tag (soft delete)
 */
async function deleteTag(id: string) {
    const response = await fetch(`${API_BASE}/admin/tags/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to delete tag: ${response.statusText}`);
    }

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

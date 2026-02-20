import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchApi } from '@/lib/api/client';

/**
 * Query keys for event location queries
 */
export const eventLocationQueryKeys = {
    all: ['event-locations'] as const,
    lists: () => [...eventLocationQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
        [...eventLocationQueryKeys.lists(), filters] as const,
    details: () => [...eventLocationQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...eventLocationQueryKeys.details(), id] as const
};

/**
 * Fetch a single event location by ID
 */
async function fetchEventLocation(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/public/event-locations/${id}`
    });
    return result.data.data;
}

/**
 * Update an event location
 */
async function updateEventLocation(id: string, data: Record<string, unknown>) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/protected/event-locations/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

/**
 * Create a new event location
 */
async function createEventLocation(data: Record<string, unknown>) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/protected/event-locations',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

/**
 * Delete an event location (soft delete)
 */
async function deleteEventLocation(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/event-locations/${id}`,
        method: 'DELETE'
    });
    return true;
}

/**
 * Hook to fetch a single event location
 */
export const useEventLocationQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: eventLocationQueryKeys.detail(id),
        queryFn: () => fetchEventLocation(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
};

/**
 * Hook to update an event location
 */
export const useUpdateEventLocationMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => updateEventLocation(id, data),
        onSuccess: (updatedData) => {
            // Update the cache with new data
            queryClient.setQueryData(eventLocationQueryKeys.detail(id), updatedData);
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: eventLocationQueryKeys.lists() });
        }
    });
};

/**
 * Hook to create an event location
 */
export const useCreateEventLocationMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => createEventLocation(data),
        onSuccess: () => {
            // Invalidate list queries to refetch
            queryClient.invalidateQueries({ queryKey: eventLocationQueryKeys.lists() });
        }
    });
};

/**
 * Hook to delete an event location
 */
export const useDeleteEventLocationMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteEventLocation(id),
        onSuccess: (_data, id) => {
            // Remove from cache
            queryClient.removeQueries({ queryKey: eventLocationQueryKeys.detail(id) });
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: eventLocationQueryKeys.lists() });
        }
    });
};

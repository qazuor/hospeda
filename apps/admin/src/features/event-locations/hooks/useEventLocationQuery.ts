import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/v1';

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
    const response = await fetch(`${API_BASE}/public/event-locations/${id}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch event location: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update an event location
 */
async function updateEventLocation(id: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/event-locations/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update event location: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Create a new event location
 */
async function createEventLocation(data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/event-locations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to create event location: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Delete an event location (soft delete)
 */
async function deleteEventLocation(id: string) {
    const response = await fetch(`${API_BASE}/admin/event-locations/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to delete event location: ${response.statusText}`);
    }

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

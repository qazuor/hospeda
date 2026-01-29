import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminLogger } from '@/utils/logger';

const API_BASE = '/api/v1';

/**
 * Query keys for event operations
 */
export const eventQueryKeys = {
    all: ['events'] as const,
    lists: () => [...eventQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...eventQueryKeys.lists(), filters] as const,
    details: () => [...eventQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...eventQueryKeys.details(), id] as const
};

/**
 * Fetch a single event by ID
 */
async function fetchEvent(id: string) {
    const response = await fetch(`${API_BASE}/public/events/${id}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch event: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update an event
 */
async function updateEvent(id: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/events/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update event: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Create a new event
 */
async function createEvent(data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/events`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to create event: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Delete an event (soft delete)
 */
async function deleteEvent(id: string) {
    const response = await fetch(`${API_BASE}/admin/events/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to delete event: ${response.statusText}`);
    }

    return true;
}

/**
 * Hook to fetch a single event by ID
 */
export const useEventQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: eventQueryKeys.detail(id),
        queryFn: () => fetchEvent(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
};

/**
 * Hook to update an event
 */
export const useUpdateEventMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => updateEvent(id, data),
        onSuccess: (updatedData) => {
            adminLogger.debug('[EventMutation] Event updated successfully', {
                id,
                data: updatedData
            });

            // Update the cache with new data
            queryClient.setQueryData(eventQueryKeys.detail(id), updatedData);
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: eventQueryKeys.lists() });
        },
        onError: (error) => {
            adminLogger.error('[EventMutation] Failed to update event', { id, error });
        }
    });
};

/**
 * Hook to create a new event
 */
export const useCreateEventMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => createEvent(data),
        onSuccess: (data) => {
            adminLogger.debug('[EventMutation] Event created successfully', data);

            // Invalidate list queries to refetch
            queryClient.invalidateQueries({ queryKey: eventQueryKeys.lists() });
        },
        onError: (error) => {
            adminLogger.error('[EventMutation] Failed to create event', error);
        }
    });
};

/**
 * Hook to delete an event
 */
export const useDeleteEventMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteEvent(id),
        onSuccess: (_data, id) => {
            adminLogger.debug('[EventMutation] Event deleted successfully', { id });

            // Remove from cache
            queryClient.removeQueries({ queryKey: eventQueryKeys.detail(id) });
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: eventQueryKeys.lists() });
        },
        onError: (error, id) => {
            adminLogger.error('[EventMutation] Failed to delete event', { id, error });
        }
    });
};

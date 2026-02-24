import type { Event } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

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
    const result = await fetchApi<{ success: boolean; data: Event }>({
        path: `/api/v1/admin/events/${id}`
    });
    return result.data.data;
}

/**
 * Update an event
 */
async function updateEvent(id: string, data: Partial<Event>) {
    const result = await fetchApi<{ success: boolean; data: Event }>({
        path: `/api/v1/admin/events/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

/**
 * Create a new event
 */
async function createEvent(data: Partial<Event>) {
    const result = await fetchApi<{ success: boolean; data: Event }>({
        path: '/api/v1/admin/events',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

/**
 * Delete an event (soft delete)
 */
async function deleteEvent(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/events/${id}`,
        method: 'DELETE'
    });
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
        mutationFn: (data: Partial<Event>) => updateEvent(id, data),
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
        mutationFn: (data: Partial<Event>) => createEvent(data),
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

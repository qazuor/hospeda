import type { EventOrganizer } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchApi } from '@/lib/api/client';

/**
 * Query keys for event organizer queries
 */
export const eventOrganizerQueryKeys = {
    all: ['event-organizers'] as const,
    lists: () => [...eventOrganizerQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
        [...eventOrganizerQueryKeys.lists(), filters] as const,
    details: () => [...eventOrganizerQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...eventOrganizerQueryKeys.details(), id] as const
};

/**
 * Fetch a single event organizer by ID
 */
async function fetchEventOrganizer(id: string) {
    const result = await fetchApi<{ success: boolean; data: EventOrganizer }>({
        path: `/api/v1/admin/event-organizers/${id}`
    });
    return result.data.data;
}

/**
 * Update an event organizer
 */
async function updateEventOrganizer(id: string, data: Partial<EventOrganizer>) {
    const result = await fetchApi<{ success: boolean; data: EventOrganizer }>({
        path: `/api/v1/admin/event-organizers/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data;
}

/**
 * Create a new event organizer
 */
async function createEventOrganizer(data: Partial<EventOrganizer>) {
    const result = await fetchApi<{ success: boolean; data: EventOrganizer }>({
        path: '/api/v1/admin/event-organizers',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

/**
 * Delete an event organizer (soft delete)
 */
async function deleteEventOrganizer(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/event-organizers/${id}`,
        method: 'DELETE'
    });
    return true;
}

/**
 * Hook to fetch a single event organizer
 */
export const useEventOrganizerQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: eventOrganizerQueryKeys.detail(id),
        queryFn: () => fetchEventOrganizer(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
};

/**
 * Hook to update an event organizer
 */
export const useUpdateEventOrganizerMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Partial<EventOrganizer>) => updateEventOrganizer(id, data),
        onSuccess: (updatedData) => {
            // Update the cache with new data
            queryClient.setQueryData(eventOrganizerQueryKeys.detail(id), updatedData);
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: eventOrganizerQueryKeys.lists() });
        }
    });
};

/**
 * Hook to create an event organizer
 */
export const useCreateEventOrganizerMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Partial<EventOrganizer>) => createEventOrganizer(data),
        onSuccess: () => {
            // Invalidate list queries to refetch
            queryClient.invalidateQueries({ queryKey: eventOrganizerQueryKeys.lists() });
        }
    });
};

/**
 * Hook to delete an event organizer
 */
export const useDeleteEventOrganizerMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteEventOrganizer(id),
        onSuccess: (_data, id) => {
            // Remove from cache
            queryClient.removeQueries({ queryKey: eventOrganizerQueryKeys.detail(id) });
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: eventOrganizerQueryKeys.lists() });
        }
    });
};

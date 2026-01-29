import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/v1';

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
    const response = await fetch(`${API_BASE}/public/event-organizers/${id}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch event organizer: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update an event organizer
 */
async function updateEventOrganizer(id: string, data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/event-organizers/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            error.message || `Failed to update event organizer: ${response.statusText}`
        );
    }

    const json = await response.json();
    return json.data;
}

/**
 * Create a new event organizer
 */
async function createEventOrganizer(data: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/protected/event-organizers`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            error.message || `Failed to create event organizer: ${response.statusText}`
        );
    }

    const json = await response.json();
    return json.data;
}

/**
 * Delete an event organizer (soft delete)
 */
async function deleteEventOrganizer(id: string) {
    const response = await fetch(`${API_BASE}/admin/event-organizers/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            error.message || `Failed to delete event organizer: ${response.statusText}`
        );
    }

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
        mutationFn: (data: Record<string, unknown>) => updateEventOrganizer(id, data),
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
        mutationFn: (data: Record<string, unknown>) => createEventOrganizer(data),
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

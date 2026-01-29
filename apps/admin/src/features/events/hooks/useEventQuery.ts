import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminLogger } from '@/utils/logger';

/**
 * Query keys for event operations
 */
export const eventQueryKeys = {
    all: ['events'] as const,
    lists: () => [...eventQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...eventQueryKeys.lists(), { filters }] as const,
    details: () => [...eventQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...eventQueryKeys.details(), id] as const
};

// Mock API functions - Replace with actual API calls
const mockFetchEvent = async (id: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
        id,
        name: `Evento ${id}`,
        slug: `evento-${id}`,
        summary: 'Resumen del evento',
        description: 'Descripción detallada del evento',
        category: 'MUSIC',
        date: {
            start: new Date().toISOString(),
            end: new Date(Date.now() + 3600000).toISOString(),
            isAllDay: false
        },
        pricing: {
            isFree: false,
            price: 5000,
            currency: 'ARS'
        },
        isFeatured: false,
        contact: {
            email: 'evento@hospeda.com',
            phone: '+54 9 11 1234-5678'
        },
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE',
        moderationState: 'APPROVED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
};

const mockUpdateEvent = async (id: string, data: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { id, ...data };
};

const mockCreateEvent = async (data: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const id = crypto.randomUUID();
    return { id, ...data };
};

const mockDeleteEvent = async (id: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { id, deleted: true };
};

/**
 * Hook to fetch a single event by ID
 */
export const useEventQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: eventQueryKeys.detail(id),
        queryFn: () => mockFetchEvent(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000 // 10 minutes (formerly cacheTime)
    });
};

/**
 * Hook to update an event
 */
export const useUpdateEventMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => mockUpdateEvent(id, data),
        onSuccess: (data) => {
            adminLogger.debug('[EventMutation] Event updated successfully', { id, data });

            // Invalidate and refetch
            queryClient.invalidateQueries({ queryKey: eventQueryKeys.detail(id) });
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
        mutationFn: (data: Record<string, unknown>) => mockCreateEvent(data),
        onSuccess: (data) => {
            adminLogger.debug('[EventMutation] Event created successfully', data);

            // Invalidate list to show new event
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
        mutationFn: (id: string) => mockDeleteEvent(id),
        onSuccess: (_data, id) => {
            adminLogger.debug('[EventMutation] Event deleted successfully', { id });

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: eventQueryKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: eventQueryKeys.lists() });
        },
        onError: (error, id) => {
            adminLogger.error('[EventMutation] Failed to delete event', { id, error });
        }
    });
};

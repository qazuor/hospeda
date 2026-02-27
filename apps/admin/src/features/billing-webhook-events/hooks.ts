import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Webhook event types
 */
export type WebhookEventStatus = 'processed' | 'failed' | 'pending';

export type WebhookEventType =
    | 'payment.created'
    | 'payment.updated'
    | 'subscription.created'
    | 'subscription.updated'
    | 'subscription.cancelled'
    | 'invoice.created'
    | 'invoice.paid'
    | 'invoice.failed';

export interface WebhookEvent {
    id: string;
    provider: string;
    type: WebhookEventType;
    status: WebhookEventStatus;
    providerEventId: string;
    receivedAt: string;
    processedAt?: string;
    payload: Record<string, unknown>;
    errorMessage?: string;
    retryCount?: number;
}

/**
 * Query keys for webhook event queries
 */
export const webhookEventQueryKeys = {
    events: {
        all: ['billing-webhook-events'] as const,
        lists: () => [...webhookEventQueryKeys.events.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...webhookEventQueryKeys.events.lists(), filters] as const,
        details: () => [...webhookEventQueryKeys.events.all, 'detail'] as const,
        detail: (id: string) => [...webhookEventQueryKeys.events.details(), id] as const,
        deadLetter: () => [...webhookEventQueryKeys.events.all, 'dead-letter'] as const
    }
};

/**
 * Fetch webhook events with filters
 */
async function fetchWebhookEvents(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{
        success: boolean;
        data: { data: Record<string, unknown>[]; total: number; limit: number; offset: number };
    }>({
        path: `/api/v1/admin/webhooks/events?${params.toString()}`
    });
    // API returns { success, data: { data: [], total, limit, offset } }
    return result.data.data.data;
}

/**
 * Fetch a single webhook event by ID
 */
async function fetchWebhookEvent(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/webhooks/events/${id}`
    });
    return result.data.data;
}

/**
 * Fetch dead letter queue events
 */
async function fetchDeadLetterEvents() {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown>[] }>({
        path: '/api/v1/admin/webhooks/dead-letter'
    });
    return result.data.data;
}

/**
 * Retry a failed webhook event
 */
async function retryWebhookEvent(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/webhooks/dead-letter/${id}/retry`,
        method: 'POST'
    });
    return result.data.data;
}

/**
 * Hook to fetch webhook events
 */
export const useWebhookEventsQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: webhookEventQueryKeys.events.list(filters),
        queryFn: () => fetchWebhookEvents(filters),
        staleTime: 30_000,
        retry: 1
    });
};

/**
 * Hook to fetch a single webhook event
 */
export const useWebhookEventQuery = (id: string) => {
    return useQuery({
        queryKey: webhookEventQueryKeys.events.detail(id),
        queryFn: () => fetchWebhookEvent(id),
        staleTime: 60_000,
        enabled: !!id,
        retry: 1
    });
};

/**
 * Hook to fetch dead letter queue events
 */
export const useDeadLetterEventsQuery = () => {
    return useQuery({
        queryKey: webhookEventQueryKeys.events.deadLetter(),
        queryFn: fetchDeadLetterEvents,
        staleTime: 30_000,
        retry: 1
    });
};

/**
 * Hook to retry a failed webhook event
 */
export const useRetryWebhookEventMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => retryWebhookEvent(id),
        onSuccess: () => {
            // Invalidate both event lists and dead letter queue
            queryClient.invalidateQueries({ queryKey: webhookEventQueryKeys.events.lists() });
            queryClient.invalidateQueries({ queryKey: webhookEventQueryKeys.events.deadLetter() });
        }
    });
};

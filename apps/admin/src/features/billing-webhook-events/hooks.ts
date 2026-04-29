import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

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

/**
 * Runtime validation schema for webhook events returned by the admin API.
 * Used to parse query responses before they reach the UI so a backend
 * shape divergence surfaces as a thrown error, not a silent crash later
 * when a missing field is read.
 */
const WebhookEventSchema = z.object({
    id: z.string(),
    provider: z.string(),
    type: z.enum([
        'payment.created',
        'payment.updated',
        'subscription.created',
        'subscription.updated',
        'subscription.cancelled',
        'invoice.created',
        'invoice.paid',
        'invoice.failed'
    ]),
    status: z.enum(['processed', 'failed', 'pending']),
    providerEventId: z.string(),
    receivedAt: z.string(),
    processedAt: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).default({}),
    errorMessage: z.string().optional(),
    retryCount: z.number().optional()
});

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

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
async function fetchWebhookEvents(filters: Record<string, unknown> = {}): Promise<WebhookEvent[]> {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{
        success: boolean;
        data: { data: unknown[]; total: number; limit: number; offset: number };
    }>({
        path: `/api/v1/admin/webhooks/events?${params.toString()}`
    });
    // API returns { success, data: { data: [], total, limit, offset } }
    return z.array(WebhookEventSchema).parse(result.data.data.data);
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
async function fetchDeadLetterEvents(): Promise<WebhookEvent[]> {
    const result = await fetchApi<{ success: boolean; data: unknown[] }>({
        path: '/api/v1/admin/webhooks/dead-letter'
    });
    return z.array(WebhookEventSchema).parse(result.data.data);
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

import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

/**
 * Runtime validation schema for payment-history records returned by the
 * billing API. SPEC-039: parsing here surfaces backend shape divergence
 * as a thrown error rather than silently corrupting the dialog render.
 */
const PaymentHistoryRecordSchema = z.object({
    id: z.string(),
    createdAt: z.string(),
    amount: z.number(),
    status: z.string()
});

export type PaymentHistoryRecord = z.infer<typeof PaymentHistoryRecordSchema>;

/**
 * Query keys for subscription-related queries
 */
export const subscriptionQueryKeys = {
    subscriptions: {
        all: ['billing-subscriptions'] as const,
        lists: () => [...subscriptionQueryKeys.subscriptions.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...subscriptionQueryKeys.subscriptions.lists(), filters] as const,
        details: () => [...subscriptionQueryKeys.subscriptions.all, 'detail'] as const,
        detail: (id: string) => [...subscriptionQueryKeys.subscriptions.details(), id] as const
    }
};

/**
 * Fetch subscriptions with filters
 */
async function fetchSubscriptions(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{
        success: boolean;
        data: Record<string, unknown>[];
        pagination: Record<string, unknown>;
    }>({
        path: `/api/v1/protected/billing/subscriptions?${params.toString()}`
    });
    // QZPay returns { success, data: [], pagination } - transform to { items, pagination }
    return { items: result.data.data, pagination: result.data.pagination };
}

/**
 * Fetch a single subscription by ID
 */
async function fetchSubscription(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/protected/billing/subscriptions/${id}`
    });
    return result.data.data;
}

/**
 * Cancel a subscription via the admin tier endpoint.
 *
 * The backend only supports end-of-period cancellation today — there is
 * no immediate-cancel path on `POST /admin/billing/subscriptions/:id/cancel`
 * (only `reason` is accepted by SubscriptionCancelBodySchema). If admins
 * need true immediate revocation it has to be added on the backend first.
 */
async function cancelSubscription(payload: { id: string; reason?: string }) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/subscriptions/${payload.id}/cancel`,
        method: 'POST',
        body: {
            reason: payload.reason
        }
    });
    return result.data.data;
}

/**
 * Change a subscription's plan from the admin panel.
 *
 * **Currently not implemented.** The `POST /admin/billing/subscriptions/:id/
 * change-plan` endpoint does not exist on the backend. The legacy
 * `PUT /protected/billing/subscriptions/:id` route operates against the
 * authenticated user's own subscription, which is incompatible with the
 * admin use case (admin changing another user's plan). This function
 * therefore throws synchronously so the UI surfaces a clear error toast
 * instead of silently hitting the wrong endpoint.
 *
 * Tracked as a billing UI gap in `docs/billing/ui-audit-2026.md`.
 */
async function changePlan(_payload: {
    subscriptionId: string;
    newPlanSlug: string;
}): Promise<Record<string, unknown>> {
    throw new Error(
        'Admin plan-change is not implemented yet — no backend endpoint exists. Contact the dev team to roll out the change manually.'
    );
}

/**
 * Hook to fetch subscriptions
 */
export const useSubscriptionsQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: subscriptionQueryKeys.subscriptions.list(filters),
        queryFn: () => fetchSubscriptions(filters),
        staleTime: 60_000,
        retry: 1
    });
};

/**
 * Hook to fetch a single subscription
 */
export const useSubscriptionQuery = (id: string) => {
    return useQuery({
        queryKey: subscriptionQueryKeys.subscriptions.detail(id),
        queryFn: () => fetchSubscription(id),
        staleTime: 60_000,
        enabled: !!id,
        retry: 1
    });
};

/**
 * Hook to cancel a subscription (end-of-period only — see {@link cancelSubscription}).
 */
export const useCancelSubscriptionMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: { id: string; reason?: string }) => cancelSubscription(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: subscriptionQueryKeys.subscriptions.lists()
            });
        }
    });
};

/**
 * Hook to change subscription plan
 */
export const useChangePlanMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: { subscriptionId: string; newPlanSlug: string }) =>
            changePlan(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: subscriptionQueryKeys.subscriptions.lists()
            });
        }
    });
};

/**
 * Extend a trial subscription
 */
async function extendTrial(payload: { subscriptionId: string; additionalDays: number }) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/protected/billing/trial/extend',
        method: 'POST',
        body: payload
    });
    return result.data.data;
}

/**
 * Hook to extend a trial period
 */
export const useExtendTrialMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: { subscriptionId: string; additionalDays: number }) =>
            extendTrial(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: subscriptionQueryKeys.subscriptions.lists()
            });
        }
    });
};

/**
 * Fetch payment history for a subscription
 */
async function fetchPaymentHistory(subscriptionId: string): Promise<PaymentHistoryRecord[]> {
    const params = new URLSearchParams();
    params.append('subscriptionId', subscriptionId);

    const result = await fetchApi<{ success: boolean; data: unknown[] }>({
        path: `/api/v1/protected/billing/payments?${params.toString()}`
    });
    return z.array(PaymentHistoryRecordSchema).parse(result.data.data);
}

/**
 * Query keys for payment-related queries
 */
export const paymentQueryKeys = {
    payments: {
        all: ['billing-payments'] as const,
        bySubscription: (subscriptionId: string) =>
            [...paymentQueryKeys.payments.all, 'subscription', subscriptionId] as const
    }
};

/**
 * Hook to fetch payment history for a subscription
 */
export const usePaymentHistoryQuery = (subscriptionId: string | undefined) => {
    return useQuery({
        queryKey: paymentQueryKeys.payments.bySubscription(subscriptionId || ''),
        queryFn: () => fetchPaymentHistory(subscriptionId as string),
        staleTime: 60_000,
        enabled: !!subscriptionId,
        retry: 1
    });
};

/**
 * Fetch subscription lifecycle events (audit trail)
 */
async function fetchSubscriptionEvents(subscriptionId: string, page: number, pageSize: number) {
    const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
    });
    const result = await fetchApi<{
        success: boolean;
        data: Array<{
            id: string;
            subscriptionId: string;
            previousStatus: string;
            newStatus: string;
            triggerSource: string;
            providerEventId: string | null;
            metadata: Record<string, unknown>;
            createdAt: string;
        }>;
        pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
    }>({
        path: `/api/v1/admin/billing/subscriptions/${subscriptionId}/events?${params.toString()}`
    });
    return { items: result.data.data, pagination: result.data.pagination };
}

/**
 * Hook to query subscription lifecycle events
 */
export function useSubscriptionEventsQuery(params: {
    readonly subscriptionId: string;
    readonly page?: number;
    readonly pageSize?: number;
    readonly enabled?: boolean;
}) {
    return useQuery({
        queryKey: ['billing-subscriptions', params.subscriptionId, 'events', params.page ?? 1],
        queryFn: () =>
            fetchSubscriptionEvents(params.subscriptionId, params.page ?? 1, params.pageSize ?? 10),
        enabled: params.enabled ?? true,
        staleTime: 60_000
    });
}

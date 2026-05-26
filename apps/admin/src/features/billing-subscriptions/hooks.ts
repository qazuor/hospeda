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
        path: `/api/v1/admin/billing/subscriptions?${params.toString()}`
    });
    return { items: result.data.data, pagination: result.data.pagination };
}

/**
 * Fetch a single subscription by ID
 */
async function fetchSubscription(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/subscriptions/${id}`
    });
    return result.data.data;
}

/**
 * Cancel a subscription via the admin tier endpoint (qzpay-hono v1.3).
 *
 * `immediate: true` cancels at once; the default is end-of-period
 * (cancelAtPeriodEnd: true on the backend). Optional `reason` is logged in
 * the subscription event audit trail.
 */
async function cancelSubscription(payload: {
    id: string;
    immediate?: boolean;
    reason?: string;
}) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/subscriptions/${payload.id}/cancel`,
        method: 'POST',
        body: {
            immediate: payload.immediate ?? false,
            reason: payload.reason
        }
    });
    return result.data.data;
}

/**
 * Change a subscription's plan from the admin panel.
 *
 * Calls the qzpay-hono v1.3 admin route, which delegates to
 * `billing.subscriptions.changePlan` and fires the onAfter hook so the
 * Hospeda audit log gets the previousPlanId/newPlanId entry.
 */
async function changePlan(payload: {
    subscriptionId: string;
    newPlanId: string;
}): Promise<Record<string, unknown>> {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/subscriptions/${payload.subscriptionId}/change-plan`,
        method: 'POST',
        body: { newPlanId: payload.newPlanId }
    });
    return result.data.data;
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
 * Hook to cancel a subscription. Pass `immediate: true` to cancel right
 * away; default is end-of-period.
 */
export const useCancelSubscriptionMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: { id: string; immediate?: boolean; reason?: string }) =>
            cancelSubscription(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: subscriptionQueryKeys.subscriptions.lists()
            });
        }
    });
};

/**
 * Pause a subscription via the admin tier endpoint (SPEC-143 #29).
 *
 * `suspendService: true` (the default on the backend) is a "full" pause: it
 * stops billing AND hides/edit-locks the owner's accommodations. `false` is a
 * billing-only hold that leaves the listings live and editable.
 */
async function pauseSubscription(payload: { id: string; suspendService?: boolean }) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/subscriptions/${payload.id}/pause`,
        method: 'POST',
        body: { suspendService: payload.suspendService ?? true }
    });
    return result.data.data;
}

/**
 * Resume a paused subscription via the admin tier endpoint (SPEC-143 #29).
 * Always clears any service suspension applied by the pause.
 */
async function resumeSubscription(payload: { id: string }) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/subscriptions/${payload.id}/resume`,
        method: 'POST'
    });
    return result.data.data;
}

/**
 * Hook to pause a subscription. Pass `suspendService: false` for a billing-only
 * hold; the default is a full pause (billing + service suspension).
 */
export const usePauseSubscriptionMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: { id: string; suspendService?: boolean }) =>
            pauseSubscription(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: subscriptionQueryKeys.subscriptions.lists()
            });
        }
    });
};

/**
 * Hook to resume a paused subscription.
 */
export const useResumeSubscriptionMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: { id: string }) => resumeSubscription(payload),
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
        mutationFn: (payload: { subscriptionId: string; newPlanId: string }) => changePlan(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: subscriptionQueryKeys.subscriptions.lists()
            });
        }
    });
};

/**
 * Extend a trial subscription via the admin tier endpoint (qzpay-hono v1.3).
 */
async function extendTrial(payload: { subscriptionId: string; additionalDays: number }) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/subscriptions/${payload.subscriptionId}/extend-trial`,
        method: 'POST',
        body: { additionalDays: payload.additionalDays }
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
        path: `/api/v1/admin/billing/payments?${params.toString()}`
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

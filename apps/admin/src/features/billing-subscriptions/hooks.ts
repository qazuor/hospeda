import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
        data: { items: Record<string, unknown>[]; pagination: Record<string, unknown> };
    }>({
        path: `/api/v1/billing/subscriptions?${params.toString()}`
    });
    return result.data.data;
}

/**
 * Fetch a single subscription by ID
 */
async function fetchSubscription(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/subscriptions/${id}`
    });
    return result.data.data;
}

/**
 * Cancel a subscription
 */
async function cancelSubscription(payload: {
    id: string;
    immediate: boolean;
    reason?: string;
}) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/subscriptions/${payload.id}`,
        method: 'DELETE',
        body: {
            immediate: payload.immediate,
            reason: payload.reason
        }
    });
    return result.data.data;
}

/**
 * Change subscription plan
 */
async function changePlan(payload: { subscriptionId: string; newPlanSlug: string }) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/subscriptions/${payload.subscriptionId}`,
        method: 'PUT',
        body: {
            planSlug: payload.newPlanSlug
        }
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
        staleTime: 60_000
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
        enabled: !!id
    });
};

/**
 * Hook to cancel a subscription
 */
export const useCancelSubscriptionMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: { id: string; immediate: boolean; reason?: string }) =>
            cancelSubscription(payload),
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
        path: '/api/v1/billing/trial/extend',
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
async function fetchPaymentHistory(subscriptionId: string) {
    const params = new URLSearchParams();
    params.append('subscriptionId', subscriptionId);

    const result = await fetchApi<{ success: boolean; data: Record<string, unknown>[] }>({
        path: `/api/v1/billing/payments?${params.toString()}`
    });
    return result.data.data;
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
        enabled: !!subscriptionId
    });
};

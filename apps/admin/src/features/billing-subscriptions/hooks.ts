import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/v1';

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

    const response = await fetch(`${API_BASE}/billing/subscriptions?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch subscriptions: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Fetch a single subscription by ID
 */
async function fetchSubscription(id: string) {
    const response = await fetch(`${API_BASE}/billing/subscriptions/${id}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch subscription: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Cancel a subscription
 */
async function cancelSubscription(payload: {
    id: string;
    immediate: boolean;
    reason?: string;
}) {
    const response = await fetch(`${API_BASE}/billing/subscriptions/${payload.id}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
            immediate: payload.immediate,
            reason: payload.reason
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to cancel subscription: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Change subscription plan
 */
async function changePlan(payload: { subscriptionId: string; newPlanSlug: string }) {
    const response = await fetch(`${API_BASE}/billing/subscriptions/${payload.subscriptionId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
            planSlug: payload.newPlanSlug
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to change plan: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
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

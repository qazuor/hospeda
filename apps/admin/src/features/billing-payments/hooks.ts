import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/v1';

/**
 * Query keys for payment-related queries
 */
export const paymentQueryKeys = {
    payments: {
        all: ['billing-payments'] as const,
        lists: () => [...paymentQueryKeys.payments.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...paymentQueryKeys.payments.lists(), filters] as const,
        details: () => [...paymentQueryKeys.payments.all, 'detail'] as const,
        detail: (id: string) => [...paymentQueryKeys.payments.details(), id] as const
    }
};

/**
 * Fetch payments with filters
 */
async function fetchPayments(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    const response = await fetch(`${API_BASE}/billing/payments?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch payments: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Fetch a single payment by ID
 */
async function fetchPayment(id: string) {
    const response = await fetch(`${API_BASE}/billing/payments/${id}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch payment: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Refund a payment
 */
async function refundPayment(payload: {
    id: string;
    amount?: number;
    reason: string;
}) {
    const response = await fetch(`${API_BASE}/billing/payments/${payload.id}/refund`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
            amount: payload.amount,
            reason: payload.reason
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to refund payment: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Hook to fetch payments
 */
export const usePaymentsQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: paymentQueryKeys.payments.list(filters),
        queryFn: () => fetchPayments(filters),
        staleTime: 60_000
    });
};

/**
 * Hook to fetch a single payment
 */
export const usePaymentQuery = (id: string) => {
    return useQuery({
        queryKey: paymentQueryKeys.payments.detail(id),
        queryFn: () => fetchPayment(id),
        staleTime: 60_000,
        enabled: !!id
    });
};

/**
 * Hook to refund a payment
 */
export const useRefundPaymentMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: { id: string; amount?: number; reason: string }) =>
            refundPayment(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: paymentQueryKeys.payments.lists() });
        }
    });
};

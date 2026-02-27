import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

    const result = await fetchApi<{
        success: boolean;
        data: Record<string, unknown>[];
        pagination: Record<string, unknown>;
    }>({
        path: `/api/v1/billing/payments?${params.toString()}`
    });
    // QZPay returns { success, data: [], pagination } - transform to { items, pagination }
    return { items: result.data.data, pagination: result.data.pagination };
}

/**
 * Fetch a single payment by ID
 */
async function fetchPayment(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/payments/${id}`
    });
    return result.data.data;
}

/**
 * Refund a payment
 */
async function refundPayment(payload: {
    id: string;
    amount?: number;
    reason: string;
}) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/payments/${payload.id}/refund`,
        method: 'POST',
        body: {
            amount: payload.amount,
            reason: payload.reason
        }
    });
    return result.data.data;
}

/**
 * Hook to fetch payments
 */
export const usePaymentsQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: paymentQueryKeys.payments.list(filters),
        queryFn: () => fetchPayments(filters),
        staleTime: 60_000,
        retry: 1
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
        enabled: !!id,
        retry: 1
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

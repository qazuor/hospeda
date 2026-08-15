import { AdminPaymentViewSchema } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { fetchApi } from '@/lib/api/client';

/**
 * Query keys for payment-related queries
 */
export const paymentQueryKeys = {
    payments: {
        all: ['billing-payments'] as const,
        lists: () => [...paymentQueryKeys.payments.all, 'list'] as const,
        list: (filters: PaymentFilterParams) =>
            [...paymentQueryKeys.payments.lists(), filters] as const,
        details: () => [...paymentQueryKeys.payments.all, 'detail'] as const,
        detail: (id: string) => [...paymentQueryKeys.payments.details(), id] as const
    }
};

/**
 * Filters accepted by the admin payments list, mirroring
 * `AdminPaymentViewSearchSchema` (`packages/schemas/src/api/billing/admin-billing-view.schema.ts`).
 */
export interface PaymentFilterParams {
    readonly status?: string;
    readonly search?: string;
    readonly startDate?: string;
    readonly endDate?: string;
    readonly minAmountInCents?: number;
    readonly maxAmountInCents?: number;
    readonly page?: number;
    readonly pageSize?: number;
}

/**
 * Fetch payments with filters.
 *
 * The response follows the standard admin list-route envelope
 * (`{ success, data: { items, pagination } }`, same as every other
 * `createAdminListRoute`-backed endpoint in this app — see
 * `features/promo-codes/hooks.ts` for the identical shape) rather than the
 * old raw qzpay-hono admin-tier shape (`{ success, data: [], pagination }`
 * with pagination as a SIBLING of data) this feature used to assume.
 *
 * Items are parsed with {@link AdminPaymentViewSchema} at the edge (SPEC-039
 * precedent): a shape divergence from the backend surfaces as a thrown error
 * here rather than silently rendering `undefined` fields deep in the table.
 */
async function fetchPayments(filters: PaymentFilterParams = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{
        success: boolean;
        data: { items: unknown[]; pagination: Record<string, unknown> };
    }>({
        path: `/api/v1/admin/billing/payments?${params.toString()}`
    });

    const items = z.array(AdminPaymentViewSchema).parse(result.data.data.items);
    return { items, pagination: result.data.data.pagination };
}

/**
 * Fetch a single payment by ID
 */
async function fetchPayment(id: string) {
    const result = await fetchApi<{ success: boolean; data: unknown }>({
        path: `/api/v1/admin/billing/payments/${id}`
    });
    return AdminPaymentViewSchema.parse(result.data.data);
}

/**
 * Refund a payment. `amountInCents` is omitted for a full refund — the
 * backend refunds the full outstanding amount. When present it is the exact
 * integer centavos to refund (qzpay-core's native unit; see
 * `onAfterPaymentRefund` in `apps/api/src/routes/billing/admin/qzpay-admin-hooks.ts`),
 * sent to the API under its existing `amount` body key.
 */
async function refundPayment(payload: { id: string; amountInCents?: number; reason: string }) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/billing/payments/${payload.id}/refund`,
        method: 'POST',
        body: {
            amount: payload.amountInCents,
            reason: payload.reason
        }
    });
    return result.data.data;
}

/**
 * Hook to fetch payments
 */
export const usePaymentsQuery = (filters: PaymentFilterParams = {}) => {
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
        mutationFn: (payload: { id: string; amountInCents?: number; reason: string }) =>
            refundPayment(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: paymentQueryKeys.payments.lists() });
        }
    });
};

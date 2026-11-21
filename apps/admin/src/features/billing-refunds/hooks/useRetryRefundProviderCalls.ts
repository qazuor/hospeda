/**
 * @file useRetryRefundProviderCalls.ts
 * Mutation for «Retry with MP» over a confirmed refund stuck on an unanswered provider call (HOS-2516).
 *
 * @module useRetryRefundProviderCalls
 */

import type { RefundProviderCallRetryResponse } from '@repo/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/**
 * Builds the path of the provider call retry of one refund.
 *
 * @param input - The refund id.
 * @returns The exact administrative path.
 */
export function buildRefundProviderCallRetryPath({
    refundId
}: {
    readonly refundId: string;
}): string {
    return `/api/v1/admin/billing-refunds/${encodeURIComponent(refundId)}/retry-provider-calls`;
}

/**
 * Resends to Mercado Pago, under their original idempotency keys, the unanswered calls of one
 * refund, then refreshes the reconciliation lists (an executed refund resolves its hung payment).
 *
 * @returns A TanStack Query mutation taking the refund id.
 */
export function useRetryRefundProviderCalls() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            refundId
        }: {
            readonly refundId: string;
        }): Promise<RefundProviderCallRetryResponse> => {
            const response = await fetchApi<{ data: RefundProviderCallRetryResponse }>({
                path: buildRefundProviderCallRetryPath({ refundId }),
                method: 'POST',
                body: { confirmed: true }
            });
            return response.data.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-reconciliation'] })
    });
}

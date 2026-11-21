/**
 * @file useSettleRefundRemainder.ts
 * Mutation for the remainder settlement of a partially accepted refund (action 14, HOS-2406).
 *
 * @module useSettleRefundRemainder
 */

import {
    type RefundRemainderSettlementRequest,
    RefundRemainderSettlementRequestSchema,
    type RefundRemainderSettlementResponse
} from '@repo/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Input of the remainder settlement: the refund and the body. */
export interface SettleRefundRemainderInput {
    readonly refundId: string;
    readonly body: RefundRemainderSettlementRequest;
}

/**
 * Builds the path of the remainder settlement of one refund.
 *
 * @param input - The refund id.
 * @returns The exact administrative path.
 */
export function buildRefundRemainderPath({ refundId }: { readonly refundId: string }): string {
    return `/api/v1/admin/billing-refunds/${encodeURIComponent(refundId)}/settle-remainder`;
}

/**
 * Records the remainder a person refunded by hand from the provider panel on a `CONFIRMED` refund
 * the provider accepted only in part, then refreshes the reconciliation lists (the closed refund
 * resolves the payment hung on its mark).
 *
 * @returns A TanStack Query mutation taking the refund id and the body.
 */
export function useSettleRefundRemainder() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            refundId,
            body
        }: SettleRefundRemainderInput): Promise<RefundRemainderSettlementResponse> => {
            const parsed = RefundRemainderSettlementRequestSchema.safeParse(body);
            if (!parsed.success) throw parsed.error;
            const response = await fetchApi<{ data: RefundRemainderSettlementResponse }>({
                path: buildRefundRemainderPath({ refundId }),
                method: 'POST',
                body: parsed.data
            });
            return response.data.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-reconciliation'] })
    });
}

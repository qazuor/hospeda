/**
 * @file useRefundDecision.ts
 * Mutations for administrative action 13: confirm a requested refund (RF2) or decline it (RF5).
 *
 * @module useRefundDecision
 */

import type { RefundConfirmationResponse, RefundDeclineResponse } from '@repo/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/**
 * Builds the path of one action 13 decision.
 *
 * @param input - The refund and the decision.
 * @returns The exact administrative path.
 */
export function buildRefundDecisionPath({
    refundId,
    decision
}: {
    readonly refundId: string;
    readonly decision: 'confirm' | 'decline';
}): string {
    return `/api/v1/admin/billing-refunds/${refundId}/${decision}`;
}

/**
 * Confirms a requested refund so it is sent to the provider, then refreshes the reconciliation
 * lists (a settled refund can open the lift of its mark).
 *
 * @returns A TanStack Query mutation taking the refund id.
 */
export function useConfirmRefundMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            refundId
        }: {
            readonly refundId: string;
        }): Promise<RefundConfirmationResponse> => {
            const response = await fetchApi<{ data: RefundConfirmationResponse }>({
                path: buildRefundDecisionPath({ refundId, decision: 'confirm' }),
                method: 'POST',
                body: { confirmed: true }
            });
            return response.data.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-reconciliation'] })
    });
}

/**
 * Declines an open refund (RF5) without touching its payment, then refreshes the reconciliation
 * lists.
 *
 * @returns A TanStack Query mutation taking the refund id.
 */
export function useDeclineRefundMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            refundId
        }: {
            readonly refundId: string;
        }): Promise<RefundDeclineResponse> => {
            const response = await fetchApi<{ data: RefundDeclineResponse }>({
                path: buildRefundDecisionPath({ refundId, decision: 'decline' }),
                method: 'POST',
                body: { declined: true }
            });
            return response.data.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-reconciliation'] })
    });
}

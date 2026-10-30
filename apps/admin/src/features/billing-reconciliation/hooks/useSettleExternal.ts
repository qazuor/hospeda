/**
 * @file useSettleExternal.ts
 * Mutations for administrative action 14 on reconciliation marks.
 */

import {
    ExternalChargeSettlementRequestSchema,
    type ExternalChargeSettlementResponse,
    type ExternalRefundSettlementRequest,
    ExternalRefundSettlementRequestSchema,
    type ExternalRefundSettlementResponse
} from '@repo/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Submits an out-of-flow refund after validating its shared contract. */
export function useSettleExternalRefund() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (body: ExternalRefundSettlementRequest) => {
            const parsed = ExternalRefundSettlementRequestSchema.safeParse(body);
            if (!parsed.success) throw parsed.error;
            const response = await fetchApi<{ data: ExternalRefundSettlementResponse }>({
                path: '/api/v1/admin/billing-refunds/external',
                method: 'POST',
                body: parsed.data
            });
            return response.data.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-reconciliation'] })
    });
}

/** Input for settling an approved provider charge absent from our records. */
export interface SettleExternalChargeInput {
    readonly chargeId: string;
    readonly note?: string;
}

/** Submits an external charge after validating its shared contract. */
export function useSettleExternalCharge() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (body: SettleExternalChargeInput) => {
            const parsed = ExternalChargeSettlementRequestSchema.safeParse(body);
            if (!parsed.success) throw parsed.error;
            const response = await fetchApi<{ data: ExternalChargeSettlementResponse }>({
                path: '/api/v1/admin/billing-refunds/external-charge',
                method: 'POST',
                body: parsed.data
            });
            return response.data.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-reconciliation'] })
    });
}

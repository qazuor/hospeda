/**
 * @file useLateManualPayment.ts
 * Reads and actions for the late manual payment (MP4) section of the subscription detail
 * (B13a fila 10-bis, HOS-1640): the installments declared unpaid, the read-only confirmation
 * and the registration itself.
 *
 * @module useLateManualPayment
 */

import {
    LateManualPaymentBodySchema,
    type LateManualPaymentPreviewResponse,
    type LateManualPaymentResponse,
    type ManualPaymentListItem
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { adminSubscriptionDetailQueryKey } from './useAdminSubscriptionDetail';

const BASE = '/api/v1/admin/billing-subscription';

/**
 * Builds the path of a subscription's installment list.
 *
 * @param input - The subscription id.
 * @returns The administrative path.
 */
export function buildManualPaymentsPath({
    subscriptionId
}: {
    readonly subscriptionId: string;
}): string {
    return `${BASE}/${encodeURIComponent(subscriptionId)}/manual-payments`;
}

/**
 * Builds the MP4 path of one installment; GET previews and POST registers.
 *
 * @param input - The subscription and installment ids.
 * @returns The administrative path.
 */
export function buildLateManualPaymentPath({
    subscriptionId,
    manualPaymentId
}: {
    readonly subscriptionId: string;
    readonly manualPaymentId: string;
}): string {
    return `${buildManualPaymentsPath({ subscriptionId })}/${encodeURIComponent(manualPaymentId)}/register-late`;
}

/**
 * Query key of a subscription's installments.
 *
 * @param input - The subscription id.
 * @returns A tuple query key.
 */
export function manualPaymentsQueryKey({
    subscriptionId
}: {
    readonly subscriptionId: string;
}): readonly unknown[] {
    return ['admin-billing-subscriptions', 'manual-payments', subscriptionId] as const;
}

/**
 * Reads the installments of a subscription that are `DECLARED_UNPAID`, the only ones MP4 takes.
 *
 * @param input - The subscription id and whether the read may run.
 * @returns A TanStack Query result with the declared unpaid installments.
 */
export function useDeclaredUnpaidInstallments({
    subscriptionId,
    enabled
}: {
    readonly subscriptionId: string;
    readonly enabled: boolean;
}) {
    return useQuery({
        queryKey: manualPaymentsQueryKey({ subscriptionId }),
        queryFn: async (): Promise<readonly ManualPaymentListItem[]> => {
            const response = await fetchApi<{ data: ManualPaymentListItem[] }>({
                path: buildManualPaymentsPath({ subscriptionId })
            });
            return response.data.data.filter((item) => item.status === 'DECLARED_UNPAID');
        },
        enabled: enabled && subscriptionId.length > 0,
        retry: false
    });
}

/**
 * Reads the MP4 confirmation of one installment. Read-only: nothing is written.
 *
 * @param input - The subscription id and the selected installment, or null.
 * @returns A TanStack Query result with the confirmation.
 */
export function useLateManualPaymentPreview({
    subscriptionId,
    manualPaymentId
}: {
    readonly subscriptionId: string;
    readonly manualPaymentId: string | null;
}) {
    return useQuery({
        queryKey: [
            'admin-billing-subscriptions',
            'late-manual-payment-preview',
            subscriptionId,
            manualPaymentId
        ] as const,
        queryFn: async (): Promise<LateManualPaymentPreviewResponse> => {
            const response = await fetchApi<{ data: LateManualPaymentPreviewResponse }>({
                path: buildLateManualPaymentPath({
                    subscriptionId,
                    manualPaymentId: manualPaymentId ?? ''
                })
            });
            return response.data.data;
        },
        enabled: manualPaymentId !== null,
        retry: false,
        gcTime: 0
    });
}

/**
 * Registers a late manual payment (MP4) and refreshes the detail and the installment list.
 *
 * @param input - The subscription id.
 * @returns A TanStack Query mutation taking the installment and an optional proof reference.
 */
export function useRegisterLateManualPayment({
    subscriptionId
}: {
    readonly subscriptionId: string;
}) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            manualPaymentId,
            proofRef
        }: {
            readonly manualPaymentId: string;
            readonly proofRef?: string;
        }): Promise<LateManualPaymentResponse> => {
            const body = LateManualPaymentBodySchema.parse(proofRef ? { proofRef } : {});
            const response = await fetchApi<{ data: LateManualPaymentResponse }>({
                path: buildLateManualPaymentPath({ subscriptionId, manualPaymentId }),
                method: 'POST',
                body
            });
            return response.data.data;
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: manualPaymentsQueryKey({ subscriptionId })
                }),
                queryClient.invalidateQueries({
                    queryKey: adminSubscriptionDetailQueryKey({ subscriptionId })
                })
            ]);
        }
    });
}

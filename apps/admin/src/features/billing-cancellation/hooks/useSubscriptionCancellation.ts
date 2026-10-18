/** @file useSubscriptionCancellation.ts — action 8 cancellation query and mutation. */

import type {
    AdminSubscriptionCancellationPreviewResponse,
    AdminSubscriptionCancellationRequest,
    AdminSubscriptionCancellationResponse
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { isApiError } from '@/lib/errors';

export function buildSubscriptionCancellationPath({
    subscriptionId
}: {
    readonly subscriptionId: string;
}): string {
    return `/api/v1/admin/billing-subscription/${subscriptionId}/cancellation`;
}

export function subscriptionCancellationPreviewQueryKey({
    subscriptionId
}: {
    readonly subscriptionId: string;
}) {
    return ['billing-subscription', 'cancellation', subscriptionId] as const;
}

export interface UseSubscriptionCancellationPreviewInput {
    readonly subscriptionId: string;
    readonly enabled: boolean;
}

export function useSubscriptionCancellationPreview({
    subscriptionId,
    enabled
}: UseSubscriptionCancellationPreviewInput) {
    return useQuery({
        queryKey: subscriptionCancellationPreviewQueryKey({ subscriptionId }),
        queryFn: async (): Promise<AdminSubscriptionCancellationPreviewResponse> => {
            const response = await fetchApi<{ data: AdminSubscriptionCancellationPreviewResponse }>(
                {
                    path: buildSubscriptionCancellationPath({ subscriptionId })
                }
            );
            return response.data.data;
        },
        enabled: enabled && subscriptionId.length > 0,
        retry: false,
        staleTime: 0
    });
}

export interface CancelSubscriptionInput {
    readonly subscriptionId: string;
    readonly expectedOrigin: 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED';
    readonly note?: string;
}

export function useCancelSubscriptionMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            subscriptionId,
            expectedOrigin,
            note
        }: CancelSubscriptionInput): Promise<AdminSubscriptionCancellationResponse> => {
            const trimmedNote = note?.trim() ?? '';
            const body: AdminSubscriptionCancellationRequest =
                trimmedNote.length > 0 ? { expectedOrigin, note: trimmedNote } : { expectedOrigin };
            const response = await fetchApi<{ data: AdminSubscriptionCancellationResponse }>({
                path: buildSubscriptionCancellationPath({ subscriptionId }),
                method: 'POST',
                body
            });
            return response.data.data;
        },
        onSettled: (_result, error, { subscriptionId }) => {
            const reason = isApiError(error)
                ? (error.body as { error?: { reason?: unknown } } | undefined)?.error?.reason
                : undefined;
            if (!error || reason === 'CANCELLATION_ORIGIN_CHANGED') {
                return queryClient.invalidateQueries({
                    queryKey: subscriptionCancellationPreviewQueryKey({ subscriptionId })
                });
            }
            return undefined;
        }
    });
}

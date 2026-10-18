/** @file useSubscriptionCancellation.ts — action 8 cancellation query and mutation. */

import type {
    AdminSubscriptionCancellationPreviewResponse,
    AdminSubscriptionCancellationRequest,
    AdminSubscriptionCancellationResponse
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { isApiError } from '@/lib/errors';

/** Builds the admin API path shared by cancellation preview and submission.
 * @param input - Subscription identifier for the path.
 * @returns The administrative cancellation endpoint path.
 */
export function buildSubscriptionCancellationPath({
    subscriptionId
}: {
    readonly subscriptionId: string;
}): string {
    return `/api/v1/admin/billing-subscription/${subscriptionId}/cancellation`;
}

/** Builds the cache key for a subscription's administrative cancellation preview.
 * @param input - Subscription identifier for the cache entry.
 * @returns A stable query key scoped to the subscription cancellation preview.
 */
export function subscriptionCancellationPreviewQueryKey({
    subscriptionId
}: {
    readonly subscriptionId: string;
}) {
    return ['billing-subscription', 'cancellation', subscriptionId] as const;
}

/** Options for loading a subscription cancellation preview. */
export interface UseSubscriptionCancellationPreviewInput {
    readonly subscriptionId: string;
    readonly enabled: boolean;
}

/** Loads the cancellation preview when the subscription identifier is valid and enabled.
 * @param input - Subscription identifier and query enablement flag.
 * @returns TanStack Query state for the cancellation preview request.
 */
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

/** Payload required to submit an administrative subscription cancellation. */
export interface CancelSubscriptionInput {
    readonly subscriptionId: string;
    readonly expectedOrigin: 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED';
    readonly note?: string;
}

/** Creates the mutation that submits cancellation and refreshes its preview when needed.
 * @returns TanStack Query mutation state for cancellation submission.
 */
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

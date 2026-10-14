/**
 * @file useSubscriptionRevocation.ts
 * Query and mutation for administrative action 8 with reason revocation
 * (ACC:8, S36; HOS-1678): revoke a subscription under the right of withdrawal.
 *
 * The preview (`GET /api/v1/admin/billing-subscription/{id}/revocation`) says
 * which payment would be refunded, how much, until when the window lasts and
 * the three things the act does; it informs and decides nothing. The act
 * (`POST` on the same path with `{ expectedPaymentId, note? }`) re-reads
 * everything under its own locks and answers 409 when the payment or the row
 * changed in between.
 *
 * @module useSubscriptionRevocation
 */

import type {
    SubscriptionRevocationPreviewResponse,
    SubscriptionRevocationRequest,
    SubscriptionRevocationResponse
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/**
 * Builds the admin path of the revocation routes for one subscription.
 *
 * @param input - The subscription's id.
 * @returns The `/api/v1/admin/billing-subscription/{id}/revocation` path.
 */
export function buildSubscriptionRevocationPath({
    subscriptionId
}: {
    readonly subscriptionId: string;
}): string {
    return `/api/v1/admin/billing-subscription/${subscriptionId}/revocation`;
}

/**
 * Query key of the revocation preview of one subscription.
 *
 * @param input - The subscription's id.
 * @returns The TanStack Query key.
 */
export function subscriptionRevocationPreviewQueryKey({
    subscriptionId
}: {
    readonly subscriptionId: string;
}) {
    return ['billing-subscription', 'revocation', subscriptionId] as const;
}

/** Input of {@link useSubscriptionRevocationPreview}. RO-RO. */
export interface UseSubscriptionRevocationPreviewInput {
    /** UUID of the subscription. */
    readonly subscriptionId: string;
    /** Whether to fetch; the screen disables it for an id that is not a uuid. */
    readonly enabled: boolean;
}

/**
 * Reads the revocation preview of one subscription. Never retries and is never
 * stale: a refusal is an answer the screen shows, and a confirmation must
 * always rest on the preview the server just gave.
 *
 * @param input - The subscription's id and whether the query runs.
 * @returns A TanStack Query result holding {@link SubscriptionRevocationPreviewResponse}.
 */
export function useSubscriptionRevocationPreview({
    subscriptionId,
    enabled
}: UseSubscriptionRevocationPreviewInput) {
    return useQuery({
        queryKey: subscriptionRevocationPreviewQueryKey({ subscriptionId }),
        queryFn: async (): Promise<SubscriptionRevocationPreviewResponse> => {
            const response = await fetchApi<{ data: SubscriptionRevocationPreviewResponse }>({
                path: buildSubscriptionRevocationPath({ subscriptionId })
            });
            return response.data.data;
        },
        enabled: enabled && subscriptionId.length > 0,
        retry: false,
        staleTime: 0
    });
}

/** Input of the revocation mutation. RO-RO. */
export interface RevokeSubscriptionInput {
    /** UUID of the subscription to revoke. */
    readonly subscriptionId: string;
    /** The `payment.id` the CURRENT preview showed. */
    readonly expectedPaymentId: string;
    /** Optional note for the audit record; sent only when it is not blank. */
    readonly note?: string;
}

/**
 * Mutation hook for the revocation. On success it invalidates the preview of
 * that subscription, which now answers that the row is no longer revocable.
 *
 * @returns A TanStack Query mutation taking {@link RevokeSubscriptionInput}.
 */
export function useRevokeSubscriptionMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            subscriptionId,
            expectedPaymentId,
            note
        }: RevokeSubscriptionInput): Promise<SubscriptionRevocationResponse> => {
            const trimmedNote = note?.trim() ?? '';
            const body: SubscriptionRevocationRequest =
                trimmedNote.length > 0
                    ? { expectedPaymentId, note: trimmedNote }
                    : { expectedPaymentId };
            const response = await fetchApi<{ data: SubscriptionRevocationResponse }>({
                path: buildSubscriptionRevocationPath({ subscriptionId }),
                method: 'POST',
                body
            });
            return response.data.data;
        },
        onSuccess: (_result, { subscriptionId }) => {
            queryClient.invalidateQueries({
                queryKey: subscriptionRevocationPreviewQueryKey({ subscriptionId })
            });
        }
    });
}

import type { SubscriptionOpenRefundsResponse } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Build the admin endpoint for the open RF1 requests of one subscription. */
export function buildSubscriptionOpenRefundsPath({
    subscriptionId
}: {
    readonly subscriptionId: string;
}): string {
    return `/api/v1/admin/billing-subscription/${subscriptionId}/open-refunds`;
}

/** Return the isolated cache key for a subscription's open RF1 requests. */
export function subscriptionOpenRefundsQueryKey({
    subscriptionId
}: {
    readonly subscriptionId: string;
}) {
    return ['billing-subscription', 'open-refunds', subscriptionId] as const;
}

/** Inputs for {@link useSubscriptionOpenRefunds}. RO-RO. */
export interface UseSubscriptionOpenRefundsInput {
    /** UUID of the subscription to inspect. */
    readonly subscriptionId: string;
    /** Whether the caller has both permissions required by the screen. */
    readonly enabled: boolean;
}

/** Read open refund requests for one subscription without retrying a failed read. */
export function useSubscriptionOpenRefunds({
    subscriptionId,
    enabled
}: UseSubscriptionOpenRefundsInput) {
    return useQuery({
        queryKey: subscriptionOpenRefundsQueryKey({ subscriptionId }),
        queryFn: async (): Promise<SubscriptionOpenRefundsResponse> => {
            const response = await fetchApi<{ data: SubscriptionOpenRefundsResponse }>({
                path: buildSubscriptionOpenRefundsPath({ subscriptionId })
            });
            return response.data.data;
        },
        enabled: enabled && subscriptionId.length > 0,
        retry: false
    });
}

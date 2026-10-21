import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Build the admin inspection endpoint for one subscription. */
export function buildSubscriptionStatusPath({
    subscriptionId
}: {
    readonly subscriptionId: string;
}): string {
    return `/api/v1/admin/billing-subscription/${subscriptionId}`;
}

/** Return the isolated cache key for one subscription status read. */
export function subscriptionStatusQueryKey({
    subscriptionId
}: {
    readonly subscriptionId: string;
}) {
    return ['billing-subscription', 'status', subscriptionId] as const;
}

/** Inputs for {@link useSubscriptionStatus}. RO-RO. */
export interface UseSubscriptionStatusInput {
    /** UUID of the subscription to inspect. */
    readonly subscriptionId: string;
    /** Whether the caller needs and may perform the status read. */
    readonly enabled: boolean;
}

/** Read one subscription's current status without retrying a failed read. */
export function useSubscriptionStatus({ subscriptionId, enabled }: UseSubscriptionStatusInput) {
    return useQuery({
        queryKey: subscriptionStatusQueryKey({ subscriptionId }),
        queryFn: async (): Promise<string> => {
            const response = await fetchApi<{ data: { status: string } }>({
                path: buildSubscriptionStatusPath({ subscriptionId })
            });
            return response.data.data.status;
        },
        enabled: enabled && subscriptionId.length > 0,
        retry: false
    });
}

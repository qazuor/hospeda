import type { AdminSubscriptionDetailHttp } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Inputs for {@link useAdminSubscriptionDetail}. */
export interface UseAdminSubscriptionDetailInput {
    /** UUID of the subscription to read. */
    readonly subscriptionId: string;
    /** Whether the caller may perform the read. Defaults to true. */
    readonly enabled?: boolean;
}

/**
 * Builds the administrative subscription overview path.
 *
 * @param input - The subscription id.
 * @returns The absolute API path for the overview.
 */
export function buildAdminSubscriptionDetailPath({
    subscriptionId
}: {
    readonly subscriptionId: string;
}): string {
    return `/api/v1/admin/billing-subscription/${subscriptionId}/overview`;
}

/**
 * Isolated query key for one subscription detail read.
 *
 * @param input - The subscription id.
 * @returns A tuple query key.
 */
export function adminSubscriptionDetailQueryKey({
    subscriptionId
}: {
    readonly subscriptionId: string;
}): readonly unknown[] {
    return ['admin-billing-subscriptions', 'detail', subscriptionId] as const;
}

/** Reads one subscription detail without retrying a failed read. */
export function useAdminSubscriptionDetail({
    subscriptionId,
    enabled = true
}: UseAdminSubscriptionDetailInput) {
    return useQuery({
        queryKey: adminSubscriptionDetailQueryKey({ subscriptionId }),
        queryFn: async (): Promise<AdminSubscriptionDetailHttp> => {
            const response = await fetchApi<{ data: AdminSubscriptionDetailHttp }>({
                path: buildAdminSubscriptionDetailPath({ subscriptionId })
            });
            return response.data.data;
        },
        enabled: enabled && subscriptionId.length > 0,
        retry: false
    });
}

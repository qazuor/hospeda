/** Reads the stored trial summary and ceiling for each listing vertical. */

import {
    type AdminTrialSummaryResponse,
    AdminTrialSummaryResponseSchema,
    SubscribeDestinationVerticalSchema
} from '@repo/schemas';
import { useQueries } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Builds the registered admin trial summary path for one vertical. */
export function buildUserTrialSummaryPath({
    userId,
    vertical
}: {
    readonly userId: string;
    readonly vertical: (typeof SubscribeDestinationVerticalSchema.options)[number];
}): string {
    return `/api/v1/admin/users/${userId}/trial-summary?vertical=${vertical}`;
}

/** Reads one user's summary independently for all verticals with a listing. */
export function useUserTrialSummaries({
    userId,
    enabled
}: {
    readonly userId: string;
    readonly enabled: boolean;
}) {
    const queries = useQueries({
        queries: SubscribeDestinationVerticalSchema.options.map((vertical) => ({
            queryKey: ['user-trial-summary', userId, vertical] as const,
            queryFn: async (): Promise<AdminTrialSummaryResponse> => {
                const response = await fetchApi<{ data: AdminTrialSummaryResponse }>({
                    path: buildUserTrialSummaryPath({ userId, vertical })
                });
                return AdminTrialSummaryResponseSchema.parse(response.data.data);
            },
            enabled: enabled && userId.length > 0,
            retry: false
        }))
    });

    return queries.map((query, index) => ({
        vertical: SubscribeDestinationVerticalSchema.options[index],
        data: query.data,
        isLoading: query.isLoading,
        isError: query.isError
    }));
}

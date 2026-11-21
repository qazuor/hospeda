/**
 * @file useProposedRefunds.ts
 * Query for the refunds proposed from a reconciliation mark that await administrative action 13.
 *
 * @module useProposedRefunds
 */

import type { ProposedRefundListResponse } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Query key prefix shared with the reconciliation marks so one invalidation refreshes both. */
export const PROPOSED_REFUNDS_QUERY_KEY = ['billing-reconciliation', 'proposed-refunds'] as const;

/**
 * Builds the paginated proposed-refund API path.
 *
 * @param input - Page and page size.
 * @returns The admin list path.
 */
export function buildProposedRefundsPath({
    page,
    pageSize
}: {
    readonly page: number;
    readonly pageSize: number;
}): string {
    return `/api/v1/admin/billing-refunds/proposed?page=${page}&pageSize=${pageSize}`;
}

/**
 * Reads one page of proposed refunds.
 *
 * @param input - Page and page size.
 * @returns A TanStack Query result with the page.
 */
export function useProposedRefunds({
    page,
    pageSize
}: {
    readonly page: number;
    readonly pageSize: number;
}) {
    return useQuery({
        queryKey: [...PROPOSED_REFUNDS_QUERY_KEY, page, pageSize],
        queryFn: async (): Promise<ProposedRefundListResponse> => {
            const response = await fetchApi<{ data: ProposedRefundListResponse }>({
                path: buildProposedRefundsPath({ page, pageSize })
            });
            return response.data.data;
        },
        retry: false
    });
}

/**
 * @file useStuckRefunds.ts
 * Query for the confirmed refunds stuck on a live provider call (HOS-2560).
 *
 * @module useStuckRefunds
 */

import type { StuckRefundListResponse } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/**
 * Query key prefix under `billing-reconciliation`, so the retry and the remainder settlement
 * (which invalidate that prefix) refresh this list too.
 */
export const STUCK_REFUNDS_QUERY_KEY = ['billing-reconciliation', 'stuck-refunds'] as const;

/**
 * Builds the paginated stuck-refund API path.
 *
 * @param input - Page and page size.
 * @returns The admin list path.
 */
export function buildStuckRefundsPath({
    page,
    pageSize
}: {
    readonly page: number;
    readonly pageSize: number;
}): string {
    return `/api/v1/admin/billing-refunds/stuck?page=${page}&pageSize=${pageSize}`;
}

/**
 * Reads one page of stuck refunds.
 *
 * @param input - Page and page size.
 * @returns A TanStack Query result with the page.
 */
export function useStuckRefunds({
    page,
    pageSize
}: {
    readonly page: number;
    readonly pageSize: number;
}) {
    return useQuery({
        queryKey: [...STUCK_REFUNDS_QUERY_KEY, page, pageSize],
        queryFn: async (): Promise<StuckRefundListResponse> => {
            const response = await fetchApi<{ data: StuckRefundListResponse }>({
                path: buildStuckRefundsPath({ page, pageSize })
            });
            return response.data.data;
        },
        retry: false
    });
}

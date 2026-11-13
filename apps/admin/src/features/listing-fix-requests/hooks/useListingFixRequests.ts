import type { AdminListingFixRequestListQuery } from '@repo/schemas';
import { AdminListingFixRequestListResponseSchema } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Shared cache key for the pending listing fix request queue. */
export const LISTING_FIX_REQUESTS_QUERY_KEY = ['listing-fix-requests'] as const;

/** Query options used to request a page of fix requests. RO-RO. */
export interface ListingFixRequestsInput {
    readonly filters: Pick<
        AdminListingFixRequestListQuery,
        'vertical' | 'ownerReported' | 'overdue'
    >;
    readonly page: number;
    readonly pageSize: number;
}

/** Builds the stable admin list URL, omitting filters that are not selected. */
export function buildListingFixRequestsPath({
    filters,
    page,
    pageSize
}: ListingFixRequestsInput): string {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (filters.vertical) params.set('vertical', filters.vertical);
    if (filters.ownerReported) params.set('ownerReported', filters.ownerReported);
    if (filters.overdue) params.set('overdue', 'true');
    return `/api/v1/admin/listing-fix-requests?${params.toString()}`;
}

/** Fetches and validates one page of pending listing fix requests. */
export function useListingFixRequests(input: ListingFixRequestsInput) {
    return useQuery({
        queryKey: [...LISTING_FIX_REQUESTS_QUERY_KEY, input],
        retry: false,
        queryFn: async () => {
            const response = await fetchApi<{ data?: unknown }>({
                path: buildListingFixRequestsPath(input),
                method: 'GET'
            });
            return AdminListingFixRequestListResponseSchema.parse(response.data.data);
        }
    });
}

import type { AdminSubscriptionListItemHttp, VerticalEnum } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Subscription status as exposed by the list contract. */
export type AdminSubscriptionStatus = AdminSubscriptionListItemHttp['status'];

/** Pagination block returned by the administrative subscription list. */
export interface AdminSubscriptionsPagination {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
}

/** One page of administrative subscriptions. */
export interface AdminSubscriptionsResponse {
    readonly items: readonly AdminSubscriptionListItemHttp[];
    readonly pagination: AdminSubscriptionsPagination;
}

/** Filters accepted by the administrative subscription list. */
export interface AdminSubscriptionsFilters {
    /** 1-based page number. */
    readonly page: number;
    /** Rows per page. */
    readonly pageSize: number;
    /** Owner email/name or subscription/user UUID search term. */
    readonly q?: string;
    /** Vertical filter. */
    readonly vertical?: VerticalEnum;
    /** Subscription status filter. */
    readonly status?: AdminSubscriptionStatus;
}

/**
 * Builds the administrative subscription list path, including only the filters
 * that carry a value so the server keeps its own defaults for the rest.
 *
 * @param filters - Page, page size and optional search/filters.
 * @returns The absolute API path for the list.
 */
export function buildAdminSubscriptionsPath(filters: AdminSubscriptionsFilters): string {
    const params = new URLSearchParams();
    params.set('page', String(filters.page));
    params.set('pageSize', String(filters.pageSize));
    const trimmed = filters.q?.trim();
    if (trimmed) params.set('q', trimmed);
    if (filters.vertical) params.set('vertical', filters.vertical);
    if (filters.status) params.set('status', filters.status);
    return `/api/v1/admin/billing-subscription?${params.toString()}`;
}

/**
 * Stable query key for one page/filter combination. Every filter participates
 * so changing the search, the vertical or the status yields a distinct entry.
 *
 * @param filters - The list filters.
 * @returns A tuple query key.
 */
export function adminSubscriptionsQueryKey(filters: AdminSubscriptionsFilters): readonly unknown[] {
    return [
        'admin-billing-subscriptions',
        'list',
        filters.page,
        filters.pageSize,
        filters.q ?? null,
        filters.vertical ?? null,
        filters.status ?? null
    ] as const;
}

/** Reads one page of administrative subscriptions without retrying failures. */
export function useAdminSubscriptions(filters: AdminSubscriptionsFilters) {
    return useQuery({
        queryKey: adminSubscriptionsQueryKey(filters),
        queryFn: async (): Promise<AdminSubscriptionsResponse> => {
            const response = await fetchApi<{ data: AdminSubscriptionsResponse }>({
                path: buildAdminSubscriptionsPath(filters)
            });
            return response.data.data;
        },
        retry: false
    });
}

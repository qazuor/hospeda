/**
 * App Logs Feature Hooks
 *
 * TanStack Query hooks for fetching application log entries (SPEC-184).
 */
import { fetchApi } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import type { AppLogEntryFilter, AppLogListResponse } from './types';

/**
 * Query keys for app log queries.
 */
export const appLogQueryKeys = {
    appLogs: {
        all: ['app-logs'] as const,
        list: (filter: AppLogEntryFilter) =>
            [...appLogQueryKeys.appLogs.all, 'list', filter] as const
    }
};

/**
 * Builds the query string for the log list request from the given filter.
 *
 * @param filter - The filter parameters to encode.
 * @returns URL-encoded query string (without leading `?`).
 */
function buildQueryString(filter: AppLogEntryFilter): string {
    const params = new URLSearchParams();
    params.set('page', String(filter.page));
    params.set('pageSize', String(filter.pageSize));
    if (filter.level) {
        params.set('level', filter.level);
    }
    if (filter.category) {
        params.set('category', filter.category);
    }
    if (filter.fromDate) {
        params.set(
            'fromDate',
            filter.fromDate instanceof Date ? filter.fromDate.toISOString() : filter.fromDate
        );
    }
    if (filter.toDate) {
        params.set(
            'toDate',
            filter.toDate instanceof Date ? filter.toDate.toISOString() : filter.toDate
        );
    }
    if (filter.requestId) {
        params.set('requestId', filter.requestId);
    }
    if (filter.userId) {
        params.set('userId', filter.userId);
    }
    if (filter.method) {
        params.set('method', filter.method);
    }
    if (filter.path) {
        params.set('path', filter.path);
    }
    return params.toString();
}

/**
 * Fetches a paginated list of application log entries from the admin API.
 *
 * @param filter - Filter and pagination parameters.
 * @returns Paginated log entry list response.
 */
async function fetchAppLogs(filter: AppLogEntryFilter): Promise<AppLogListResponse> {
    const qs = buildQueryString(filter);
    const result = await fetchApi<{ success: boolean; data: AppLogListResponse }>({
        path: `/api/v1/admin/logs?${qs}`
    });
    return result.data.data;
}

/**
 * Hook to fetch a paginated, filtered list of application log entries.
 *
 * @param filter - Active filter and pagination state.
 */
export const useAppLogsQuery = (filter: AppLogEntryFilter) => {
    return useQuery({
        queryKey: appLogQueryKeys.appLogs.list(filter),
        queryFn: () => fetchAppLogs(filter),
        staleTime: 30_000,
        retry: 1
    });
};

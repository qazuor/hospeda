/**
 * Hook for polling the total unread conversation count.
 *
 * Calls GET /api/v1/admin/conversations/unread-count every 30 seconds.
 * Used by the sidebar badge component to show pending messages.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { isApiError } from '@/lib/errors';
import type { UnreadCountResponse } from '../types';
import { conversationQueryKeys } from './useConversations';

/** Base polling cadence for the unread-count badge. */
export const UNREAD_COUNT_POLL_INTERVAL_MS = 30_000;

/**
 * A 403 is terminal for this poller: the current actor lacks the conversations
 * permission and will not gain it within the session, so re-polling is pointless
 * and only floods the API logs + rate limiter with 403s every 30s (HOS-109 T-006).
 *
 * @param error - The last query error, if any.
 * @returns True when the error is an API 403 (forbidden).
 */
export function isForbiddenApiError(error: unknown): boolean {
    return isApiError(error) && error.isForbiddenError();
}

/**
 * Polling cadence decision: keep polling every
 * {@link UNREAD_COUNT_POLL_INTERVAL_MS} unless the last response was a 403, in
 * which case stop permanently (HOS-109 T-006).
 *
 * @param error - The last query error, if any.
 * @returns The next interval in ms, or `false` to stop polling.
 */
export function unreadCountRefetchInterval(error: unknown): number | false {
    return isForbiddenApiError(error) ? false : UNREAD_COUNT_POLL_INTERVAL_MS;
}

/**
 * Retry decision. Client errors (4xx — including 403 permission denials and 429
 * rate-limit responses) are never retried: retrying them only amplifies the same
 * failure against the API and the rate limiter (matches the app-wide policy in
 * the root QueryClient — SPEC-117 M-2). Genuine transient failures (network /
 * 5xx) are retried up to 3 times.
 *
 * @param failureCount - How many times the query has already failed.
 * @param error - The failure.
 * @returns True to retry, false to give up.
 */
export function unreadCountShouldRetry(failureCount: number, error: unknown): boolean {
    if (isApiError(error) && error.isClientError()) {
        return false;
    }
    return failureCount < 3;
}

/**
 * Fetch and periodically refresh the unread conversation count.
 *
 * Polls every {@link UNREAD_COUNT_POLL_INTERVAL_MS} while access is granted, but
 * stops permanently once the endpoint returns 403 — an actor without the
 * conversations permission would otherwise re-hit it forever (HOS-109 T-006).
 *
 * @returns TanStack Query result with { count } data
 */
export function useUnreadCount() {
    return useQuery({
        queryKey: conversationQueryKeys.unreadCount(),
        queryFn: async (): Promise<UnreadCountResponse> => {
            const response = await fetchApi<{
                success: boolean;
                data: UnreadCountResponse;
            }>({
                path: '/api/v1/admin/conversations/unread-count'
            });

            return response.data.data;
        },
        refetchInterval: (query) => unreadCountRefetchInterval(query.state.error),
        retry: unreadCountShouldRetry,
        staleTime: 25_000,
        gcTime: 5 * 60 * 1000
    });
}

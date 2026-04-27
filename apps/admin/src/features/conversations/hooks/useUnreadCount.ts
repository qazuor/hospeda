/**
 * Hook for polling the total unread conversation count.
 *
 * Calls GET /api/v1/admin/conversations/unread-count every 30 seconds.
 * Used by the sidebar badge component to show pending messages.
 */

import { fetchApi } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import type { UnreadCountResponse } from '../types';
import { conversationQueryKeys } from './useConversations';

/**
 * Fetch and periodically refresh the unread conversation count.
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
        refetchInterval: 30_000,
        staleTime: 25_000,
        gcTime: 5 * 60 * 1000
    });
}

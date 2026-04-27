/**
 * Hook for fetching the paginated conversations inbox.
 *
 * Calls GET /api/v1/admin/conversations with optional filter params.
 * Owners see only their accommodations' conversations (auto-scoped server-side).
 * Super-admins with CONVERSATION_VIEW_ALL see everything.
 */

import { fetchApi } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import type { ConversationListFilters, ConversationListResponse } from '../types';

/** TanStack Query key factory for conversation queries */
export const conversationQueryKeys = {
    all: ['conversations'] as const,
    lists: () => [...conversationQueryKeys.all, 'list'] as const,
    list: (filters?: ConversationListFilters) =>
        [...conversationQueryKeys.lists(), filters] as const,
    details: () => [...conversationQueryKeys.all, 'detail'] as const,
    detail: (id: string, cursor?: string) =>
        [...conversationQueryKeys.details(), id, cursor] as const,
    unreadCount: () => [...conversationQueryKeys.all, 'unread-count'] as const
};

/**
 * Fetch the paginated conversations list with optional filters.
 *
 * @param filters - Optional query parameters (status, accommodationId, etc.)
 * @returns TanStack Query result with ConversationListResponse data
 */
export function useConversations(filters?: ConversationListFilters) {
    return useQuery({
        queryKey: conversationQueryKeys.list(filters),
        queryFn: async (): Promise<ConversationListResponse> => {
            const params = new URLSearchParams();

            if (filters) {
                for (const [key, value] of Object.entries(filters)) {
                    if (value !== undefined && value !== null) {
                        params.append(key, String(value));
                    }
                }
            }

            const response = await fetchApi<{
                success: boolean;
                data: ConversationListResponse;
            }>({
                path: `/api/v1/admin/conversations?${params.toString()}`
            });

            return response.data.data;
        },
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev
    });
}

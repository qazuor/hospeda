/**
 * Hook for fetching a single conversation thread.
 *
 * Calls GET /api/v1/admin/conversations/:id?cursor=&limit=
 * Supports cursor-based pagination for older messages (scroll-up pattern).
 */

import { fetchApi } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import type { ConversationThread } from '../types';
import { conversationQueryKeys } from './useConversations';

/** Input shape for the useConversation hook */
export interface UseConversationOptions {
    /** Conversation ID to fetch */
    id: string;
    /** Cursor for fetching older messages (createdAt < cursor) */
    cursor?: string;
    /** Max messages per page (default 50) */
    limit?: number;
    /** Whether the query should be active */
    enabled?: boolean;
}

/**
 * Fetch a conversation thread, optionally with cursor-based pagination.
 *
 * @param options - Query options including ID and cursor
 * @returns TanStack Query result with ConversationThread data
 */
export function useConversation({
    id,
    cursor,
    limit = 50,
    enabled = true
}: UseConversationOptions) {
    return useQuery({
        queryKey: conversationQueryKeys.detail(id, cursor),
        queryFn: async (): Promise<ConversationThread> => {
            const params = new URLSearchParams({ limit: String(limit) });
            if (cursor) {
                params.append('cursor', cursor);
            }

            const response = await fetchApi<{
                success: boolean;
                data: {
                    conversation: ConversationThread;
                    messages: ConversationThread['messages'];
                    olderCursor?: string;
                };
            }>({
                path: `/api/v1/admin/conversations/${id}?${params.toString()}`
            });

            const { conversation, messages, olderCursor } = response.data.data;

            return {
                ...conversation,
                messages,
                olderCursor
            };
        },
        enabled: enabled && Boolean(id),
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000
    });
}

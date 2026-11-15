/**
 * TanStack Query hooks for the staff AI conversations screens (HOS-2075).
 *
 * - `GET /api/v1/admin/ai/conversations`     -> {@link useAiConversationsQuery}
 * - `GET /api/v1/admin/ai/conversations/:id` -> {@link useAiConversationQuery}
 *
 * @module features/ai-conversations/hooks
 */

import type { AiConversationDetail, AiConversationListItem } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import type { AiConversationsSearch } from './types';
import { buildAiConversationsSearchParams } from './types';

/** Paginated list envelope returned by admin list routes. */
export interface AiConversationsPage {
    readonly items: readonly AiConversationListItem[];
    readonly pagination: {
        readonly page: number;
        readonly pageSize: number;
        readonly total: number;
        readonly totalPages: number;
    };
}

/** Query key factory. */
export const aiConversationsQueryKeys = {
    all: ['ai-conversations'] as const,
    list: (filters: AiConversationsSearch) =>
        [...aiConversationsQueryKeys.all, 'list', filters] as const,
    detail: (id: string) => [...aiConversationsQueryKeys.all, 'detail', id] as const
};

/**
 * Builds the list request path for the given filters.
 *
 * @param filters - Resolved list filters.
 * @returns API path including the query string.
 */
export const buildAiConversationsListPath = (filters: AiConversationsSearch): string => {
    const { entityType, entityId, from, to, page, pageSize } = filters;
    const params = buildAiConversationsSearchParams({
        entityType,
        entityId,
        from,
        to,
        page,
        pageSize
    });
    return `/api/v1/admin/ai/conversations?${params.toString()}`;
};

async function fetchConversations(filters: AiConversationsSearch): Promise<AiConversationsPage> {
    const result = await fetchApi<{ success: boolean; data: AiConversationsPage }>({
        path: buildAiConversationsListPath(filters)
    });
    return result.data.data;
}

async function fetchConversation(id: string): Promise<AiConversationDetail> {
    const result = await fetchApi<{ success: boolean; data: AiConversationDetail }>({
        path: `/api/v1/admin/ai/conversations/${encodeURIComponent(id)}`
    });
    return result.data.data;
}

/**
 * Fetches one page of conversations.
 *
 * @param filters - Resolved search params from the route.
 */
export const useAiConversationsQuery = (filters: AiConversationsSearch) =>
    useQuery({
        queryKey: aiConversationsQueryKeys.list(filters),
        queryFn: () => fetchConversations(filters),
        staleTime: 60_000,
        retry: 1
    });

/**
 * Fetches one conversation with its turns.
 *
 * @param id - Conversation UUID.
 */
export const useAiConversationQuery = (id: string) =>
    useQuery({
        queryKey: aiConversationsQueryKeys.detail(id),
        queryFn: () => fetchConversation(id),
        staleTime: 60_000,
        retry: 1
    });

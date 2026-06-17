/**
 * @file use-owner-conversations.ts
 * @description Hooks for the host-owner conversation inbox (SPEC-243 T-043).
 *
 * List endpoint:    GET /api/v1/protected/conversations/owner
 *   Query params:   page, pageSize, status?, search?
 *   Response data:  { items: OwnerConversationItem[], pagination: { total, page, pageSize, totalPages } }
 *
 * Unread-count endpoint: GET /api/v1/protected/conversations/owner/unread-count
 *   Response data:  { count: number }
 *
 * Both endpoints require CONVERSATION_VIEW_OWN permission (enforced server-side).
 *
 * @module lib/api/hooks/use-owner-conversations
 */
import { z } from 'zod';
import { useApiQuery } from '../use-api-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Pagination envelope schema shared by list endpoints. */
const PaginationSchema = z.object({
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalPages: z.number().int().min(0)
});

/**
 * Schema for a single enriched inbox item returned by GET /conversations/owner.
 *
 * The API enriches each conversation row with accommodationName, guestName,
 * lastMessageExcerpt, and unreadCount before returning (single round trip).
 */
export const OwnerConversationItemSchema = z.object({
    id: z.string().uuid(),
    accommodationId: z.string().uuid(),
    accommodationName: z.string().nullable(),
    userId: z.string().uuid().nullable(),
    anonymousName: z.string().nullable(),
    guestName: z.string().nullable(),
    lastMessageExcerpt: z.string().nullable(),
    unreadCount: z.number().int().min(0),
    status: z.string(),
    lastActivityAt: z.union([z.string().datetime(), z.date()]).nullable(),
    createdAt: z.union([z.string().datetime(), z.date()]),
    updatedAt: z.union([z.string().datetime(), z.date()])
});

export type OwnerConversationItem = z.infer<typeof OwnerConversationItemSchema>;

/**
 * List response schema for GET /api/v1/protected/conversations/owner.
 * The API client unwraps the `{success,data}` envelope; this schema
 * validates the `data` payload which uses the `createPaginatedResponse` helper.
 */
export const OwnerConversationsListSchema = z.object({
    items: z.array(OwnerConversationItemSchema),
    pagination: PaginationSchema
});

export type OwnerConversationsList = z.infer<typeof OwnerConversationsListSchema>;

/**
 * Unread-count response schema for GET /api/v1/protected/conversations/owner/unread-count.
 */
export const OwnerUnreadCountSchema = z.object({
    count: z.number().int().min(0)
});

export type OwnerUnreadCount = z.infer<typeof OwnerUnreadCountSchema>;

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

/** Stable TanStack Query keys for owner conversations. */
export const ownerConversationKeys = {
    all: ['owner-conversations'] as const,
    lists: () => [...ownerConversationKeys.all, 'list'] as const,
    list: (params: Record<string, unknown>) => [...ownerConversationKeys.lists(), params] as const,
    unreadCount: () => [...ownerConversationKeys.all, 'unread-count'] as const
};

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Input params for {@link useOwnerConversations}.
 */
export interface UseOwnerConversationsInput {
    /** Page number (1-based). Defaults to 1. */
    readonly page?: number;
    /** Items per page. Defaults to 20. */
    readonly pageSize?: number;
    /** Filter by conversation status. Omit to return all statuses. */
    readonly status?: string;
    /** Full-text search string. Omit to return all. */
    readonly search?: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the authenticated owner's conversation inbox (paginated).
 *
 * Each item is enriched server-side with accommodationName, guestName,
 * lastMessageExcerpt, and unreadCount, so no extra round trips are needed
 * to render inbox rows.
 *
 * @param input - Optional pagination / filter params.
 * @returns TanStack `UseQueryResult<OwnerConversationsList>`.
 *
 * @example
 * ```ts
 * const { data, isLoading } = useOwnerConversations({ page: 1, pageSize: 20 });
 * data?.items.forEach(item => console.log(item.guestName, item.unreadCount));
 * ```
 */
export function useOwnerConversations({
    page = 1,
    pageSize = 20,
    status,
    search
}: UseOwnerConversationsInput = {}) {
    const params: Record<string, unknown> = { page, pageSize };
    if (status) params.status = status;
    if (search) params.search = search;

    return useApiQuery({
        queryKey: ownerConversationKeys.list(params),
        path: '/api/v1/protected/conversations/owner',
        query: params as Record<string, string | number | boolean | null | undefined>,
        schema: OwnerConversationsListSchema,
        staleTime: 60 * 1000 // 1 minute — inbox is relatively fresh
    });
}

/**
 * Fetches the total count of conversations with unread activity for the
 * authenticated owner, scoped to their accommodations.
 *
 * Used for the Consultas tab badge and the dashboard card.
 *
 * @returns TanStack `UseQueryResult<OwnerUnreadCount>`.
 *
 * @example
 * ```ts
 * const { data } = useOwnerUnreadCount();
 * const badge = data?.count ?? 0;
 * ```
 */
export function useOwnerUnreadCount() {
    return useApiQuery({
        queryKey: ownerConversationKeys.unreadCount(),
        path: '/api/v1/protected/conversations/owner/unread-count',
        schema: OwnerUnreadCountSchema,
        staleTime: 60 * 1000 // 1 minute
    });
}

/**
 * @file use-conversation-thread.ts
 * @description Hook for fetching a single conversation thread for the host owner (SPEC-243 T-044).
 *
 * Endpoint: GET /api/v1/protected/conversations/owner/:id
 *   Response data:  { conversation: EnrichedConversation, messages: Message[], nextCursor: string | null }
 *
 * Fetching this endpoint also updates `lastReadAtByOwner` server-side, marking
 * the conversation as read for the owner.
 *
 * @module lib/api/hooks/use-conversation-thread
 */
import { z } from 'zod';
import { useApiQuery } from '../use-api-query';
import { ownerConversationKeys } from './use-owner-conversations';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Schema for a single message in the thread.
 * Mirrors packages/schemas/src/entities/conversation/message.schema.ts
 * but keeps only the fields needed for rendering.
 */
export const ThreadMessageSchema = z.object({
    id: z.string().uuid(),
    conversationId: z.string().uuid(),
    senderType: z.string(),
    userId: z.string().uuid().nullable(),
    body: z.string(),
    status: z.string(),
    createdAt: z.union([z.string().datetime(), z.date()]),
    updatedAt: z.union([z.string().datetime(), z.date()])
});

export type ThreadMessage = z.infer<typeof ThreadMessageSchema>;

/**
 * Schema for the enriched conversation returned by the thread endpoint.
 * The API adds accommodationName and guestName to the base conversation row.
 */
export const ThreadConversationSchema = z.object({
    id: z.string().uuid(),
    accommodationId: z.string().uuid(),
    accommodationName: z.string().nullable(),
    userId: z.string().uuid().nullable(),
    anonymousName: z.string().nullable(),
    guestName: z.string().nullable(),
    status: z.string(),
    locale: z.string(),
    createdAt: z.union([z.string().datetime(), z.date()]),
    updatedAt: z.union([z.string().datetime(), z.date()])
});

export type ThreadConversation = z.infer<typeof ThreadConversationSchema>;

/**
 * Response schema for GET /api/v1/protected/conversations/owner/:id.
 *
 * `nextCursor` is an ISO-8601 datetime string pointing to the oldest message's
 * createdAt when older pages exist; null when all messages are loaded.
 */
export const ConversationThreadSchema = z.object({
    conversation: ThreadConversationSchema,
    messages: z.array(ThreadMessageSchema),
    nextCursor: z.string().nullable()
});

export type ConversationThread = z.infer<typeof ConversationThreadSchema>;

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

/** Stable TanStack Query keys for conversation threads. */
export const conversationThreadKeys = {
    all: ['conversation-thread'] as const,
    details: () => [...conversationThreadKeys.all, 'detail'] as const,
    detail: (id: string) => [...conversationThreadKeys.details(), id] as const
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches a single conversation thread for the authenticated owner.
 *
 * The endpoint updates `lastReadAtByOwner` server-side on every fetch,
 * effectively marking the conversation as read.
 *
 * Query is disabled when `id` is falsy to prevent spurious requests while
 * the route param is being resolved.
 *
 * Fetches invalidate the owner unread-count via the `ownerConversationKeys`
 * factory — callers must manually invalidate when needed (e.g., after reply).
 *
 * @param id - Conversation UUID from the route param. Query disabled when falsy.
 * @returns TanStack `UseQueryResult<ConversationThread>`.
 *
 * @example
 * ```ts
 * const { id } = useLocalSearchParams<{ id: string }>();
 * const { data, isLoading } = useConversationThread(id);
 * data?.messages.forEach(msg => console.log(msg.senderType, msg.body));
 * ```
 */
export function useConversationThread(id: string | undefined) {
    return useApiQuery({
        queryKey: conversationThreadKeys.detail(id ?? ''),
        path: `/api/v1/protected/conversations/owner/${id ?? ''}`,
        schema: ConversationThreadSchema,
        enabled: !!id,
        staleTime: 30 * 1000 // 30 seconds — thread data is time-sensitive
    });
}

// Re-export ownerConversationKeys so callers can access them for invalidation
export { ownerConversationKeys };

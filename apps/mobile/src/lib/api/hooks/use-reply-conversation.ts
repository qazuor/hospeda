/**
 * @file use-reply-conversation.ts
 * @description Hook for posting a reply to a conversation as the host owner (SPEC-243 T-044).
 *
 * Endpoint: POST /api/v1/protected/conversations/owner/:id/messages
 *   Body:   { body: string } (CreateMessageSchema — field name is `body`)
 *   Response: the created Message row (status 201)
 *
 * On success, invalidates:
 * - the thread query for the conversation
 * - the owner conversation list query
 * - the unread-count query
 *
 * Uses a dynamic path built from the mutation variable `id`, so `apiFetch`
 * is called directly inside `mutationFn` (same pattern as use-patch-accommodation.ts).
 *
 * @module lib/api/hooks/use-reply-conversation
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '../client';
import { conversationThreadKeys } from './use-conversation-thread';
import { ownerConversationKeys } from './use-owner-conversations';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Schema for the message created by a reply (mirrors MessageSchema).
 * Used to validate the 201 response body.
 */
export const CreatedMessageSchema = z.object({
    id: z.string().uuid(),
    conversationId: z.string().uuid(),
    senderType: z.string(),
    userId: z.string().uuid().nullable(),
    body: z.string(),
    status: z.string(),
    createdAt: z.union([z.string().datetime(), z.date()]),
    updatedAt: z.union([z.string().datetime(), z.date()])
});

export type CreatedMessage = z.infer<typeof CreatedMessageSchema>;

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * Variables passed to `mutation.mutate(vars)`.
 */
export interface ReplyConversationVariables {
    /** Conversation UUID. Used to build the dynamic endpoint path. */
    readonly id: string;
    /** Message body text (1..5000 characters, per CreateMessageSchema). */
    readonly body: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Mutation hook for posting an OWNER-side reply to a conversation.
 *
 * Calls `POST /api/v1/protected/conversations/owner/:id/messages` with the
 * body `{ body: string }` (field name `body`, per CreateMessageSchema).
 *
 * On success, invalidates the thread, the owner inbox list, and the
 * unread-count query so all dependent UI refreshes automatically.
 *
 * @returns TanStack `UseMutationResult<CreatedMessage, Error, ReplyConversationVariables>`.
 *
 * @example
 * ```ts
 * const mutation = useReplyConversation();
 * mutation.mutate({ id: conversationId, body: 'Hola! Gracias por tu consulta.' });
 * ```
 */
export function useReplyConversation(): UseMutationResult<
    CreatedMessage,
    Error,
    ReplyConversationVariables
> {
    const queryClient = useQueryClient();

    return useMutation<CreatedMessage, Error, ReplyConversationVariables>({
        mutationFn: async ({ id, body }: ReplyConversationVariables) => {
            const { data } = await apiFetch({
                path: `/api/v1/protected/conversations/owner/${id}/messages`,
                method: 'POST',
                body: { body },
                schema: CreatedMessageSchema
            });
            return data;
        },
        onSuccess: (_data, variables) => {
            // Refresh the thread so the new message appears immediately
            void queryClient.invalidateQueries({
                queryKey: conversationThreadKeys.detail(variables.id)
            });
            // Refresh the inbox list (lastMessageExcerpt / lastActivityAt may change)
            void queryClient.invalidateQueries({
                queryKey: ownerConversationKeys.lists()
            });
            // Refresh the unread badge (owner replying clears their own unread)
            void queryClient.invalidateQueries({
                queryKey: ownerConversationKeys.unreadCount()
            });
        }
    });
}

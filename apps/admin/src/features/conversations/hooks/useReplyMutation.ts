/**
 * Mutation hook for sending an owner reply in a conversation.
 *
 * Calls POST /api/v1/admin/conversations/:id/messages
 * Invalidates the thread query on success.
 */

import { fetchApi } from '@/lib/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationQueryKeys } from './useConversations';

/** Input for the reply mutation */
export interface ReplyMutationInput {
    /** Conversation ID to reply to */
    conversationId: string;
    /** Message body text */
    body: string;
}

/**
 * Send an owner reply to a conversation.
 *
 * @returns TanStack Mutation object — call mutate({ conversationId, body }) to submit.
 */
export function useReplyMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, body }: ReplyMutationInput) => {
            const response = await fetchApi<{ success: boolean; data: unknown }>({
                path: `/api/v1/admin/conversations/${conversationId}/messages`,
                method: 'POST',
                body: { body }
            });
            return response.data;
        },
        onSuccess: (_data, { conversationId }) => {
            // Invalidate the thread so the new message appears immediately
            queryClient.invalidateQueries({
                queryKey: conversationQueryKeys.details()
            });
            // Also invalidate the specific conversation detail cache
            queryClient.invalidateQueries({
                queryKey: conversationQueryKeys.detail(conversationId)
            });
        }
    });
}

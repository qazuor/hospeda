/**
 * Mutation hook for soft-deleting a conversation.
 *
 * Calls DELETE /api/v1/admin/conversations/:id
 * Requires CONVERSATION_DELETE_ANY permission (enforced by the API).
 * Invalidates the list on success.
 */

import { fetchApi } from '@/lib/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationQueryKeys } from './useConversations';

/**
 * Soft-delete a conversation (admin only — requires CONVERSATION_DELETE_ANY).
 *
 * @returns TanStack Mutation object — call mutate(conversationId) to trigger.
 */
export function useDeleteConversationMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (conversationId: string) => {
            const response = await fetchApi<{ success: boolean; data: unknown }>({
                path: `/api/v1/admin/conversations/${conversationId}`,
                method: 'DELETE'
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: conversationQueryKeys.lists() });
        }
    });
}

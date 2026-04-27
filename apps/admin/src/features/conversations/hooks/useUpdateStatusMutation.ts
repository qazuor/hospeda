/**
 * Mutation hook for updating a conversation's status.
 *
 * Calls PATCH /api/v1/admin/conversations/:id/status
 * Invalidates both the list and the thread on success.
 */

import { fetchApi } from '@/lib/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ConversationStatus } from '../types';
import { conversationQueryKeys } from './useConversations';

/** Input for the update-status mutation */
export interface UpdateStatusMutationInput {
    /** Conversation ID to update */
    conversationId: string;
    /** New status value */
    status: ConversationStatus;
    /** Optional reason when blocking */
    blockReason?: string;
}

/**
 * Update the status of a conversation (close, reopen, block).
 *
 * @returns TanStack Mutation object
 */
export function useUpdateStatusMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, status, blockReason }: UpdateStatusMutationInput) => {
            const response = await fetchApi<{ success: boolean; data: unknown }>({
                path: `/api/v1/admin/conversations/${conversationId}/status`,
                method: 'PATCH',
                body: { status, ...(blockReason ? { blockReason } : {}) }
            });
            return response.data;
        },
        onSuccess: (_data, { conversationId }) => {
            // Invalidate both the list and the thread detail
            queryClient.invalidateQueries({ queryKey: conversationQueryKeys.lists() });
            queryClient.invalidateQueries({
                queryKey: conversationQueryKeys.detail(conversationId)
            });
        }
    });
}

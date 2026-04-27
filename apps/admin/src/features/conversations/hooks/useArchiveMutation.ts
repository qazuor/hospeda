/**
 * Mutation hook for toggling the archivedByOwner flag on a conversation.
 *
 * Calls PATCH /api/v1/admin/conversations/:id/archive
 * Invalidates the list on success.
 */

import { fetchApi } from '@/lib/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationQueryKeys } from './useConversations';

/** Input for the archive mutation */
export interface ArchiveMutationInput {
    /** Conversation ID to archive or unarchive */
    conversationId: string;
    /** true to archive, false to unarchive */
    archived: boolean;
}

/**
 * Toggle the archivedByOwner flag on a conversation.
 *
 * @returns TanStack Mutation object
 */
export function useArchiveMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, archived }: ArchiveMutationInput) => {
            const response = await fetchApi<{ success: boolean; data: unknown }>({
                path: `/api/v1/admin/conversations/${conversationId}/archive`,
                method: 'PATCH',
                body: { archived }
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: conversationQueryKeys.lists() });
        }
    });
}

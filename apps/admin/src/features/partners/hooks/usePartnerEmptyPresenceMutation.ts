import { PartnerEmptyPresenceResponseSchema } from '@repo/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { partnerQueryKeys } from './usePartnerQuery';

/** Posts a confirmed action 25 request and refreshes the Partner detail. */
export function usePartnerEmptyPresenceMutation(partnerId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ reason }: { readonly reason: string }) => {
            const result = await fetchApi<{ success: boolean; data: unknown }>({
                path: `/api/v1/admin/partners/${partnerId}/empty-presence`,
                method: 'POST',
                body: { reason, confirm: true }
            });
            return PartnerEmptyPresenceResponseSchema.parse(result.data.data);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: partnerQueryKeys.detail(partnerId) });
        }
    });
}

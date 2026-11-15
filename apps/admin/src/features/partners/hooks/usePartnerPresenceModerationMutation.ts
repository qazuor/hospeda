import {
    PartnerPresenceModerationResponseSchema,
    type PartnerPresenceModerationSchema
} from '@repo/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { fetchApi } from '@/lib/api/client';
import { partnerQueryKeys } from './usePartnerQuery';

type PartnerPresenceModerationInput = z.infer<typeof PartnerPresenceModerationSchema>;

/** Posts a Partner presence moderation action and refreshes its detail query. AC:V7:14; ACC:12 (sources: action 13). */
export function usePartnerPresenceModerationMutation(partnerId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (body: PartnerPresenceModerationInput) => {
            const result = await fetchApi<{ success: boolean; data: unknown }>({
                path: `/api/v1/admin/partners/${partnerId}/presence-moderation`,
                method: 'POST',
                body
            });
            return PartnerPresenceModerationResponseSchema.parse(result.data.data);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: partnerQueryKeys.detail(partnerId) });
        }
    });
}

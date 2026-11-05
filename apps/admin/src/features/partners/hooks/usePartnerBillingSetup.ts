import {
    PartnerBillingSetupPreviewResponseSchema,
    type PartnerBillingSetupRequest,
    PartnerBillingSetupResponseSchema
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { partnerQueryKeys } from './usePartnerQuery';

const previewKey = (partnerId: string) => ['partners', partnerId, 'billing-setup'] as const;

/** Reads action 6's no-write preview only while its dialog is open. AC:V7:17; ACC:6. */
export function usePartnerBillingSetupPreview(partnerId: string, enabled: boolean) {
    return useQuery({
        queryKey: previewKey(partnerId),
        enabled,
        queryFn: async () => {
            const result = await fetchApi<{ success: boolean; data: unknown }>({
                path: `/api/v1/admin/partners/${partnerId}/billing-setup`
            });
            return PartnerBillingSetupPreviewResponseSchema.parse(result.data.data);
        }
    });
}

/** Posts an explicitly confirmed action 6 request and refreshes Partner data. AC:V7:17; ACC:6. */
export function usePartnerBillingSetupMutation(partnerId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (body: PartnerBillingSetupRequest) => {
            const result = await fetchApi<{ success: boolean; data: unknown }>({
                path: `/api/v1/admin/partners/${partnerId}/billing-setup`,
                method: 'POST',
                body
            });
            return PartnerBillingSetupResponseSchema.parse(result.data.data);
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: partnerQueryKeys.detail(partnerId) }),
                queryClient.invalidateQueries({ queryKey: previewKey(partnerId) })
            ]);
        }
    });
}

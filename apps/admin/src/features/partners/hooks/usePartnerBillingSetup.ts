import type { TranslationKey } from '@repo/i18n';
import {
    PartnerBillingSetupPreviewResponseSchema,
    type PartnerBillingSetupRequest,
    PartnerBillingSetupResponseSchema
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { partnerQueryKeys } from './usePartnerQuery';

const previewKey = (partnerId: string) => ['partners', partnerId, 'billing-setup'] as const;
type BillingOption = z.infer<typeof PartnerBillingSetupPreviewResponseSchema>['options'][number];

/** Maps action 6 API rejections to their localized messages. AC:V7:17; ACC:6. */
export function partnerBillingSetupErrorKey(error: unknown): TranslationKey {
    if (!(error instanceof ApiError)) return 'admin-entities.partnerBillingSetup.errors.generic';
    if (error.status === 403) return 'admin-entities.partnerBillingSetup.errors.forbidden';
    const body = error.body as { error?: { reason?: string } } | undefined;
    if (error.status === 409 && body?.error?.reason === 'PARTNER_WITHOUT_OWNER')
        return 'admin-entities.partnerBillingSetup.errors.partnerWithoutOwner';
    if (error.status === 409) return 'admin-entities.partnerBillingSetup.errors.commitmentTaken';
    if (error.status === 422) return 'admin-entities.partnerBillingSetup.errors.planNotForSale';
    return 'admin-entities.partnerBillingSetup.errors.generic';
}

/** Formats an action 6 option amount for the active locale. AC:V7:17; ACC:6. */
export function formatPartnerBillingSetupAmount(option: BillingOption, locale: string): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: option.currency }).format(
        option.amountMinor / 100
    );
}

/** Returns the localized billing-cycle key for an action 6 option. AC:V7:17; ACC:6. */
export function partnerBillingSetupCycleKey(cycle: BillingOption['cycle']): TranslationKey {
    return `admin-entities.partnerBillingSetup.cycle.${cycle}`;
}

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

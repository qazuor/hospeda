import type { QrCampaignsUmamiResponse } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { qrCodeQueryKeys } from './useQrCodes';

/**
 * Hook for the QR campaigns panel (HOS-2679): every campaign with its code count
 * and its «Ver en Umami» link. The API builds the link from its own config and
 * never calls Umami, and the panel creates nothing in Umami.
 *
 * The key lives under `qrCodeQueryKeys.all`, so dropping the QR root (after a
 * retarget, which can add or remove a campaign) drops this too.
 *
 * @module features/qr-codes/hooks/useQrCampaignsUmami
 */

/** Path of the endpoint. */
const QR_CAMPAIGNS_UMAMI_PATH = '/api/v1/admin/qr-codes/campaigns/umami';

/** Query keys for this module, derived from the QR root. */
export const qrCampaignUmamiQueryKeys = {
    list: () => [...qrCodeQueryKeys.all, 'campaigns-umami'] as const
};

/** The answer when the API sends no body: nothing listed. */
const EMPTY: QrCampaignsUmamiResponse = { items: [] };

/** How long the campaigns read stays fresh before a remount refetches it. */
export const QR_CAMPAIGNS_UMAMI_STALE_TIME_MS = 60_000;

/**
 * The campaigns with their counts and Umami links.
 *
 * @param input.enabled - Whether to run the query (default true).
 * @returns The query.
 */
export function useQrCampaignsUmami(input: { readonly enabled?: boolean } = {}) {
    return useQuery({
        queryKey: qrCampaignUmamiQueryKeys.list(),
        queryFn: async (): Promise<QrCampaignsUmamiResponse> => {
            const response = await fetchApi<{ data?: QrCampaignsUmamiResponse }>({
                path: QR_CAMPAIGNS_UMAMI_PATH
            });
            return response.data?.data ?? EMPTY;
        },
        // The filter link and the dialog share this read.
        staleTime: QR_CAMPAIGNS_UMAMI_STALE_TIME_MS,
        enabled: input.enabled ?? true
    });
}

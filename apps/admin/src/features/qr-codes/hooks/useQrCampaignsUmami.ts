import type { QrCampaignsUmamiResponse, QrCampaignUmamiSegmentResponse } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { qrCodeQueryKeys } from './useQrCodes';

/**
 * Hooks for the QR campaigns panel (HOS-2679 PR 2): every campaign with its
 * code count and its state in Umami, and the on-demand segment creation.
 *
 * The key lives under `qrCodeQueryKeys.all`, so dropping the QR root (after a
 * retarget, which can add or remove a campaign) drops this too.
 *
 * @module features/qr-codes/hooks/useQrCampaignsUmami
 */

/** Base path of the two endpoints. */
const QR_CAMPAIGNS_ENDPOINT = '/api/v1/admin/qr-codes/campaigns';

/** Query keys for this module, derived from the QR root. */
export const qrCampaignUmamiQueryKeys = {
    list: () => [...qrCodeQueryKeys.all, 'campaigns-umami'] as const
};

/** The answer when the API sends no body: nothing listed, nothing creatable. */
const EMPTY: QrCampaignsUmamiResponse = { items: [], canCreateSegments: false };

/**
 * The campaigns with their Umami state. The API never fails because of Umami
 * (rows come back `unavailable`), so an error here is the API itself.
 *
 * @param input.enabled - Whether to run the query (default true).
 * @returns The query.
 */
/** How long the campaigns read stays fresh before a remount refetches it. */
export const QR_CAMPAIGNS_UMAMI_STALE_TIME_MS = 60_000;

export function useQrCampaignsUmami(input: { readonly enabled?: boolean } = {}) {
    return useQuery({
        queryKey: qrCampaignUmamiQueryKeys.list(),
        queryFn: async (): Promise<QrCampaignsUmamiResponse> => {
            const response = await fetchApi<{ data?: QrCampaignsUmamiResponse }>({
                path: `${QR_CAMPAIGNS_ENDPOINT}/umami`
            });
            return response.data?.data ?? EMPTY;
        },
        // The filter link and the dialog share this read; one Umami call per minute is plenty.
        staleTime: QR_CAMPAIGNS_UMAMI_STALE_TIME_MS,
        enabled: input.enabled ?? true
    });
}

/**
 * Creates (or finds) the Umami segment of one campaign, then refetches the list.
 *
 * @returns The mutation; resolves to the row and whether it was created now.
 */
export function useCreateQrCampaignSegment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: {
            readonly campaign: string;
        }): Promise<QrCampaignUmamiSegmentResponse> => {
            const response = await fetchApi<{ data?: QrCampaignUmamiSegmentResponse }>({
                path: `${QR_CAMPAIGNS_ENDPOINT}/umami-segment`,
                method: 'POST',
                body: { campaign: input.campaign }
            });
            const data = response.data?.data;
            if (!data) throw new Error('qr-campaign-segment-empty-response');
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qrCampaignUmamiQueryKeys.list() });
        }
    });
}

/**
 * The machine-readable `reason` of a failed create, if the API sent one
 * (`UMAMI_WRITE_NOT_CONFIGURED`, `UMAMI_KEY_REJECTED`, `UMAMI_UNAVAILABLE`).
 *
 * @param input.error - What the mutation threw.
 * @returns The reason, or `undefined`.
 */
export function readQrCampaignSegmentErrorReason(input: {
    readonly error: unknown;
}): string | undefined {
    if (!(input.error instanceof ApiError)) return undefined;
    const body = input.error.body as { error?: { reason?: unknown } } | undefined;
    const reason = body?.error?.reason;
    return typeof reason === 'string' ? reason : undefined;
}

import type { QrCode, QrCodeDownloadResponse, QrCodeFormatEnum } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { createEntityHooks } from '@/lib/factories/createEntityHooks';

/**
 * QR-code admin hooks (HOS-981 PR 3).
 *
 * @module features/qr-codes/hooks/useQrCodes
 */

/** Base path of the admin QR tier. */
const QR_CODES_ENDPOINT = '/api/v1/admin/qr-codes';

const entityHooks = createEntityHooks<QrCode>({
    entityName: 'qr-codes',
    apiEndpoint: QR_CODES_ENDPOINT
});

export const {
    useList: useQrCodesList,
    useDetail: useQrCodeDetail,
    useCreate: useCreateQrCode,
    useDelete: useDeleteQrCode,
    queryKeys: qrCodeQueryKeys
} = entityHooks;

/**
 * Partial update.
 *
 * `usePatch`, never `useUpdate`. The factory's `useUpdate` issues a PUT, and the
 * API deliberately exposes only PATCH here: a QR code's `renderOptions` is a
 * document merged key by key, so a full-document write is exactly the operation
 * that loses the drawing settings the form did not touch.
 */
export const useUpdateQrCode = entityHooks.usePatch;

/**
 * Fetches the rendered image for one code.
 *
 * Deliberately NOT a `useQuery`: a download is something an operator asks for by
 * clicking, not something a detail page should fetch on mount in both formats.
 * The response carries a `data:` URL ready for an anchor's `href` plus, for SVG,
 * the raw markup for an inline preview.
 */
export function useDownloadQrCode() {
    return useMutation({
        mutationFn: async ({
            id,
            format
        }: {
            readonly id: string;
            readonly format?: QrCodeFormatEnum;
        }): Promise<QrCodeDownloadResponse> => {
            const query = format ? `?format=${format}` : '';
            const response = await fetchApi<{ data?: QrCodeDownloadResponse }>({
                path: `${QR_CODES_ENDPOINT}/${id}/download${query}`
            });
            return response.data?.data as QrCodeDownloadResponse;
        }
    });
}

/**
 * The preview shown on the detail page.
 *
 * Separate from {@link useDownloadQrCode} because it IS a read that belongs on
 * mount: the operator has to see the symbol that is about to be printed, drawn
 * with the code's stored options, before deciding to download anything.
 */
export function useQrCodePreview(id: string | undefined) {
    return useQuery({
        queryKey: ['qr-codes', 'preview', id ?? ''],
        queryFn: async (): Promise<QrCodeDownloadResponse> => {
            const response = await fetchApi<{ data?: QrCodeDownloadResponse }>({
                path: `${QR_CODES_ENDPOINT}/${id}/download`
            });
            return response.data?.data as QrCodeDownloadResponse;
        },
        enabled: !!id
    });
}

/**
 * Invalidates every cached QR query.
 *
 * Retargeting a code changes what the detail page shows AND what the preview
 * encodes is unaffected — but the stored render options are not, so the preview
 * has to be dropped alongside the row.
 */
export function useInvalidateQrCodes() {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: ['qr-codes'] });
    };
}

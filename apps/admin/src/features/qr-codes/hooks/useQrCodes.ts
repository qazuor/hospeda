import type {
    QrCode,
    QrCodeDownloadResponse,
    QrCodeFormatEnum,
    QrCodeUpdateHttp
} from '@repo/schemas';
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
    queryKeys: qrCodeQueryKeys
} = entityHooks;

/**
 * Cache key of the rendered preview for one code.
 *
 * Derived from `qrCodeQueryKeys.all` rather than spelled out, so it can never
 * drift out from under the invalidation in {@link useInvalidateQrCodes}: both
 * sides are built from the same root.
 */
export const qrCodePreviewKey = (id: string) => [...qrCodeQueryKeys.all, 'preview', id] as const;

/**
 * Drops EVERY cached QR query — list, detail and preview alike.
 *
 * The width is the point. `invalidateQueries` matches by PREFIX, and the
 * preview lives at `['qr-codes', 'preview', id]`, a SIBLING of
 * `['qr-codes', 'detail', id]` and `['qr-codes', 'list']`. Invalidating those
 * two therefore leaves the preview untouched, and with a five-minute
 * `staleTime` and no refetch on focus it stays on screen showing the OLD
 * drawing while the download button hands over the new one — the exact
 * divergence `routes/qr-code/admin/download.ts` calls unacceptable, since a code
 * that differs from what the panel showed is a code somebody prints and
 * discovers is wrong once it is on a wall.
 *
 * So this invalidates the ROOT. Narrowing it back to the two child keys
 * re-introduces the bug; `useQrCodes.test.tsx` fails when that happens.
 */
export function useInvalidateQrCodes() {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: qrCodeQueryKeys.all });
    };
}

/**
 * Partial update.
 *
 * PATCH, never PUT. The API deliberately exposes only PATCH here: a QR code's
 * `renderOptions` is a document merged key by key, so a full-document write is
 * exactly the operation that loses the drawing settings the form did not touch.
 *
 * Written out rather than taken from `createEntityHooks.usePatch` because that
 * factory invalidates only `detail` and `lists` — see
 * {@link useInvalidateQrCodes} for why that is not enough for this entity.
 */
export function useUpdateQrCode() {
    const invalidateAll = useInvalidateQrCodes();

    return useMutation({
        mutationFn: async ({
            id,
            data
        }: {
            readonly id: string;
            readonly data: QrCodeUpdateHttp;
        }): Promise<QrCode> => {
            const response = await fetchApi<{ data?: QrCode }>({
                path: `${QR_CODES_ENDPOINT}/${id}`,
                method: 'PATCH',
                body: data
            });
            return response.data?.data as QrCode;
        },
        onSuccess: () => {
            invalidateAll();
        }
    });
}

/**
 * Soft-deletes one code, and REFUSES to call a no-op a success.
 *
 * The endpoint answers `200 {success: false}` when the soft delete matched no
 * row — an id already deleted by somebody else. The entity-hooks factory's
 * `useDelete` never reads the body, so that answer resolved normally and the
 * page toasted "eliminado" and navigated away. Two operators working from stale
 * lists: the second one is told they deleted something they did not touch.
 *
 * Throwing turns it into the error path the page already handles.
 */
export function useDeleteQrCode() {
    const invalidateAll = useInvalidateQrCodes();

    return useMutation({
        mutationFn: async (id: string): Promise<string> => {
            const response = await fetchApi<{ data?: { success?: boolean } }>({
                path: `${QR_CODES_ENDPOINT}/${id}`,
                method: 'DELETE'
            });
            if (response.data?.data?.success !== true) {
                throw new Error('qr-code-delete-no-op');
            }
            return id;
        },
        onSuccess: () => {
            invalidateAll();
        }
    });
}

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
        queryKey: qrCodePreviewKey(id ?? ''),
        queryFn: async (): Promise<QrCodeDownloadResponse> => {
            const response = await fetchApi<{ data?: QrCodeDownloadResponse }>({
                path: `${QR_CODES_ENDPOINT}/${id}/download`
            });
            return response.data?.data as QrCodeDownloadResponse;
        },
        enabled: !!id
    });
}

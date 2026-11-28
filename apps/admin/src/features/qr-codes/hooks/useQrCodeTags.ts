import type {
    QrCodeCampaignsResponse,
    QrCodeTag,
    QrCodeTagCreateInput,
    QrCodeTagRef,
    QrCodeTagsResponse,
    QrCodeTagUpdateInput
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { qrCodeQueryKeys, useInvalidateQrCodes } from './useQrCodes';

/**
 * Hooks for organising QR codes in the admin (HOS-2679): the tag catalog, the
 * tag set of one code, and the campaign dropdown.
 *
 * Every key lives under `qrCodeQueryKeys.all`, so {@link useInvalidateQrCodes}
 * — which drops the ROOT — also drops these. That is wanted: renaming a tag
 * changes what every list row shows, and retargeting a code can add or remove a
 * campaign.
 *
 * @module features/qr-codes/hooks/useQrCodeTags
 */

/** Base path of the tag catalog. */
const QR_CODE_TAGS_ENDPOINT = '/api/v1/admin/qr-code-tags';

/** Base path of the QR codes themselves. */
const QR_CODES_ENDPOINT = '/api/v1/admin/qr-codes';

/**
 * The size of the one catalog page the pickers load. The API caps `pageSize` at
 * 100; a catalog bigger than that is no longer "organising a list".
 */
export const QR_CODE_TAG_CATALOG_PAGE_SIZE = 100;

/** Query keys for this module, derived from the QR root. */
export const qrCodeTagQueryKeys = {
    catalog: () => [...qrCodeQueryKeys.all, 'tag-catalog'] as const,
    tagsOf: (id: string) => [...qrCodeQueryKeys.all, 'tags-of', id] as const,
    campaigns: () => [...qrCodeQueryKeys.all, 'campaigns'] as const
};

/**
 * The tag catalog, sorted by name.
 *
 * @returns The query; `data` is the catalog rows.
 */
export function useQrCodeTagCatalog() {
    return useQuery({
        queryKey: qrCodeTagQueryKeys.catalog(),
        queryFn: async (): Promise<readonly QrCodeTag[]> => {
            const response = await fetchApi<{ data?: { items?: QrCodeTag[] } }>({
                path: `${QR_CODE_TAGS_ENDPOINT}?page=1&pageSize=${QR_CODE_TAG_CATALOG_PAGE_SIZE}`
            });
            return response.data?.data?.items ?? [];
        }
    });
}

/**
 * The distinct campaigns stored on QR targets, for the filter dropdown.
 *
 * @returns The query; `data` is the decoded, sorted campaigns.
 */
export function useQrCodeCampaigns() {
    return useQuery({
        queryKey: qrCodeTagQueryKeys.campaigns(),
        queryFn: async (): Promise<readonly string[]> => {
            const response = await fetchApi<{ data?: QrCodeCampaignsResponse }>({
                path: `${QR_CODES_ENDPOINT}/campaigns`
            });
            return response.data?.data?.items ?? [];
        }
    });
}

/**
 * The tags one code carries. Used by the edit form, which loads one code and so
 * has no list row to read them from.
 *
 * @param id - The QR code id; the query waits while it is undefined.
 * @returns The query; `data` is the tag refs.
 */
export function useQrCodeTagsOf(id: string | undefined) {
    return useQuery({
        queryKey: qrCodeTagQueryKeys.tagsOf(id ?? ''),
        queryFn: async (): Promise<readonly QrCodeTagRef[]> => {
            const response = await fetchApi<{ data?: QrCodeTagsResponse }>({
                path: `${QR_CODES_ENDPOINT}/${id}/tags`
            });
            return response.data?.data?.items ?? [];
        },
        enabled: !!id
    });
}

/**
 * Replaces the COMPLETE tag set of one code (an empty list clears it).
 *
 * @returns The mutation; resolves to the tags the code now carries.
 */
export function useSetQrCodeTags() {
    const invalidateAll = useInvalidateQrCodes();
    return useMutation({
        mutationFn: async (input: {
            readonly id: string;
            readonly tagIds: readonly string[];
        }): Promise<readonly QrCodeTagRef[]> => {
            const response = await fetchApi<{ data?: QrCodeTagsResponse }>({
                path: `${QR_CODES_ENDPOINT}/${input.id}/tags`,
                method: 'PUT',
                body: { tagIds: [...input.tagIds] }
            });
            return response.data?.data?.items ?? [];
        },
        onSuccess: () => {
            invalidateAll();
        }
    });
}

/**
 * Creates a catalog tag. The API derives the slug and answers 409 for a name
 * that collides with a live tag.
 *
 * @returns The mutation; resolves to the created tag.
 */
export function useCreateQrCodeTag() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: QrCodeTagCreateInput): Promise<QrCodeTag> => {
            const response = await fetchApi<{ data?: QrCodeTag }>({
                path: QR_CODE_TAGS_ENDPOINT,
                method: 'POST',
                body: input
            });
            return response.data?.data as QrCodeTag;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qrCodeTagQueryKeys.catalog() });
        }
    });
}

/**
 * Renames or recolours a catalog tag. Every row carrying it changes, so this
 * drops the whole QR root rather than only the catalog.
 *
 * @returns The mutation; resolves to the updated tag.
 */
export function useUpdateQrCodeTag() {
    const invalidateAll = useInvalidateQrCodes();
    return useMutation({
        mutationFn: async (input: {
            readonly id: string;
            readonly data: QrCodeTagUpdateInput;
        }): Promise<QrCodeTag> => {
            const response = await fetchApi<{ data?: QrCodeTag }>({
                path: `${QR_CODE_TAGS_ENDPOINT}/${input.id}`,
                method: 'PATCH',
                body: input.data
            });
            return response.data?.data as QrCodeTag;
        },
        onSuccess: () => {
            invalidateAll();
        }
    });
}

/**
 * Soft-deletes a catalog tag and, like {@link useDeleteQrCode}, refuses to call
 * a zero-row delete a success.
 *
 * @returns The mutation; resolves to the deleted id.
 */
export function useDeleteQrCodeTag() {
    const invalidateAll = useInvalidateQrCodes();
    return useMutation({
        mutationFn: async (id: string): Promise<string> => {
            const response = await fetchApi<{ data?: { success?: boolean } }>({
                path: `${QR_CODE_TAGS_ENDPOINT}/${id}`,
                method: 'DELETE'
            });
            if (response.data?.data?.success !== true) {
                throw new Error('qr-code-tag-delete-no-op');
            }
            return id;
        },
        onSuccess: () => {
            invalidateAll();
        }
    });
}

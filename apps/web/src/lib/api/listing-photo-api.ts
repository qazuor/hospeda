/**
 * @file listing-photo-api.ts
 * @description One photo API for the three listing verticals (HOS-2495).
 *
 * The shared photo editor (`PhotoSection.client.tsx`) talks to this adapter and
 * never to a vertical's client directly. Accommodation delegates to
 * `accommodationMediaApi`; venue and experience delegate to `listingMediaApi`.
 * Rows come back normalized to one {@link ListingPhotoRow} (nullable text fields
 * read as `undefined`), so the editor's mappers do not branch on the vertical.
 */

import type { ListingPhotoAllowance } from '@repo/schemas';
import type { MediaAttribution } from '@/lib/media';
import { uploadEntityImage } from '@/lib/media/upload-entity';
import {
    type AccommodationMediaRow,
    accommodationMediaApi,
    type ListingMediaRow,
    type ListingPhotoVertical,
    listingMediaApi,
    listingPhotoAllowanceApi
} from './endpoints-protected';
import type { ApiResult } from './types';

export type { ListingPhotoVertical };

/** A photo row as the shared editor reads it, whatever the vertical. */
export interface ListingPhotoRow {
    readonly id: string;
    readonly url: string;
    readonly publicId?: string;
    readonly caption?: string;
    readonly description?: string;
    readonly alt?: string;
    readonly attribution?: MediaAttribution | null;
    readonly isFeatured: boolean;
    readonly sortOrder: number;
    readonly state: 'visible' | 'archived';
    readonly moderationState: string;
}

/** Body of a new photo row; `sortOrder` and `isFeatured` are server-controlled. */
export interface ListingPhotoAddBody {
    readonly url: string;
    readonly publicId?: string;
    readonly moderationState?: string;
}

/** Text metadata PATCH: omit a field to keep it, `null` to clear it. */
export interface ListingPhotoUpdateBody {
    readonly caption?: string | null;
    readonly description?: string | null;
    readonly alt?: string | null;
    readonly attribution?: MediaAttribution | null;
}

/** Every photo operation of one listing vertical. */
export interface ListingPhotoApi {
    readonly vertical: ListingPhotoVertical;
    listMedia(params: {
        readonly id: string;
    }): Promise<ApiResult<{ readonly media: readonly ListingPhotoRow[] }>>;
    addMedia(params: {
        readonly id: string;
        readonly body: ListingPhotoAddBody;
    }): Promise<ApiResult<{ readonly media: ListingPhotoRow }>>;
    addFeaturedMedia(params: {
        readonly id: string;
        readonly body: ListingPhotoAddBody;
    }): Promise<ApiResult<{ readonly media: ListingPhotoRow }>>;
    removeMedia(params: {
        readonly id: string;
        readonly mediaId: string;
    }): Promise<ApiResult<Record<string, unknown>>>;
    setFeaturedMedia(params: {
        readonly id: string;
        readonly mediaId: string;
    }): Promise<ApiResult<{ readonly media: ListingPhotoRow }>>;
    reorderMedia(params: {
        readonly id: string;
        readonly orderedIds: readonly string[];
    }): Promise<ApiResult<{ readonly media: readonly ListingPhotoRow[] }>>;
    updateMedia(params: {
        readonly id: string;
        readonly mediaId: string;
        readonly body: ListingPhotoUpdateBody;
    }): Promise<ApiResult<{ readonly media: ListingPhotoRow }>>;
    getAllowance(params: { readonly id: string }): Promise<ApiResult<ListingPhotoAllowance>>;
    uploadImage(params: {
        readonly file: File;
        readonly listingId: string;
        readonly role: 'featured' | 'gallery';
        readonly onProgress?: (percent: number) => void;
    }): Promise<{ url: string; publicId: string; width: number; height: number }>;
}

/**
 * Normalize a vertical's media row to {@link ListingPhotoRow}.
 *
 * @param row - The accommodation or listing media row.
 * @returns The row with nullable text fields read as `undefined`.
 */
export function toListingPhotoRow(row: AccommodationMediaRow | ListingMediaRow): ListingPhotoRow {
    return {
        id: row.id,
        url: row.url,
        publicId: row.publicId ?? undefined,
        caption: row.caption ?? undefined,
        description: row.description ?? undefined,
        alt: row.alt ?? undefined,
        attribution: row.attribution ?? null,
        isFeatured: row.isFeatured,
        sortOrder: row.sortOrder,
        state: row.state,
        moderationState: row.moderationState
    };
}

/** Map an `ApiResult` carrying one row. */
function mapOne<T extends { readonly media: AccommodationMediaRow | ListingMediaRow }>(
    result: ApiResult<T>
): ApiResult<{ readonly media: ListingPhotoRow }> {
    return result.ok
        ? { ok: true, data: { media: toListingPhotoRow(result.data.media) } }
        : { ok: false, error: result.error };
}

/** Map an `ApiResult` carrying a list of rows. */
function mapMany(
    result: ApiResult<{ readonly media: readonly (AccommodationMediaRow | ListingMediaRow)[] }>
): ApiResult<{ readonly media: readonly ListingPhotoRow[] }> {
    return result.ok
        ? { ok: true, data: { media: result.data.media.map(toListingPhotoRow) } }
        : { ok: false, error: result.error };
}

/**
 * Build the photo API of one listing vertical.
 *
 * @param params.vertical - `accommodation`, `venue` or `experience`.
 * @returns The adapter the shared photo editor consumes.
 *
 * @example
 * ```ts
 * const api = createListingPhotoApi({ vertical: 'venue' });
 * const list = await api.listMedia({ id: venueId });
 * ```
 */
export function createListingPhotoApi({
    vertical
}: {
    readonly vertical: ListingPhotoVertical;
}): ListingPhotoApi {
    const shared = {
        vertical,
        getAllowance: ({ id }: { readonly id: string }) =>
            listingPhotoAllowanceApi.getAllowance({ vertical, id }),
        uploadImage: ({
            file,
            listingId,
            role,
            onProgress
        }: {
            readonly file: File;
            readonly listingId: string;
            readonly role: 'featured' | 'gallery';
            readonly onProgress?: (percent: number) => void;
        }) =>
            uploadEntityImage({ file, entityType: vertical, entityId: listingId, role, onProgress })
    };

    if (vertical === 'accommodation') {
        return {
            ...shared,
            listMedia: async ({ id }) => mapMany(await accommodationMediaApi.listMedia({ id })),
            addMedia: async ({ id, body }) =>
                mapOne(await accommodationMediaApi.addMedia({ id, body })),
            addFeaturedMedia: async ({ id, body }) =>
                mapOne(await accommodationMediaApi.addFeaturedMedia({ id, body })),
            removeMedia: ({ id, mediaId }) => accommodationMediaApi.removeMedia({ id, mediaId }),
            setFeaturedMedia: async ({ id, mediaId }) =>
                mapOne(await accommodationMediaApi.setFeaturedMedia({ id, mediaId })),
            reorderMedia: async ({ id, orderedIds }) =>
                mapMany(await accommodationMediaApi.reorderMedia({ id, orderedIds })),
            updateMedia: async ({ id, mediaId, body }) =>
                mapOne(await accommodationMediaApi.updateMedia({ id, mediaId, body }))
        };
    }

    return {
        ...shared,
        listMedia: async ({ id }) => mapMany(await listingMediaApi.listMedia({ vertical, id })),
        addMedia: async ({ id, body }) =>
            mapOne(await listingMediaApi.addMedia({ vertical, id, body })),
        addFeaturedMedia: async ({ id, body }) =>
            mapOne(await listingMediaApi.addFeaturedMedia({ vertical, id, body })),
        removeMedia: ({ id, mediaId }) => listingMediaApi.removeMedia({ vertical, id, mediaId }),
        setFeaturedMedia: async ({ id, mediaId }) =>
            mapOne(await listingMediaApi.setFeaturedMedia({ vertical, id, mediaId })),
        reorderMedia: async ({ id, orderedIds }) =>
            mapMany(await listingMediaApi.reorderMedia({ vertical, id, orderedIds })),
        updateMedia: async ({ id, mediaId, body }) =>
            mapOne(await listingMediaApi.updateMedia({ vertical, id, mediaId, body }))
    };
}

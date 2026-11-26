/**
 * @file listing-photo-api.test.ts
 * @description The photo adapter of the shared editor (HOS-2495): each vertical
 * reaches its own media endpoints, its own allowance and the upload-entity
 * route with its own `entityType`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createListingPhotoApi, toListingPhotoRow } from '@/lib/api/listing-photo-api';

const { accommodationMediaApi, listingMediaApi, getAllowance, uploadEntityImage } = vi.hoisted(
    () => {
        const api = () => ({
            listMedia: vi.fn(),
            addMedia: vi.fn(),
            addFeaturedMedia: vi.fn(),
            removeMedia: vi.fn(),
            setFeaturedMedia: vi.fn(),
            reorderMedia: vi.fn(),
            updateMedia: vi.fn()
        });
        return {
            accommodationMediaApi: api(),
            listingMediaApi: api(),
            getAllowance: vi.fn(),
            uploadEntityImage: vi.fn()
        };
    }
);

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationMediaApi,
    listingMediaApi,
    listingPhotoAllowanceApi: { getAllowance }
}));
vi.mock('@/lib/media/upload-entity', () => ({ uploadEntityImage }));

const ROW = {
    id: 'm1',
    url: 'https://cdn.example.com/m1.jpg',
    publicId: null,
    caption: null,
    description: 'Vista',
    alt: null,
    attribution: null,
    isFeatured: false,
    sortOrder: 1,
    state: 'visible',
    moderationState: 'APPROVED'
};

beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of [...Object.values(accommodationMediaApi), ...Object.values(listingMediaApi)]) {
        fn.mockResolvedValue({ ok: true, data: { media: [ROW] } });
    }
    accommodationMediaApi.removeMedia.mockResolvedValue({ ok: true, data: {} });
    listingMediaApi.removeMedia.mockResolvedValue({ ok: true, data: {} });
});

describe.each(['venue', 'experience'] as const)('createListingPhotoApi(%s)', (vertical) => {
    it('routes every media call to the listing API with the vertical, never the accommodation API', async () => {
        const api = createListingPhotoApi({ vertical });
        listingMediaApi.addMedia.mockResolvedValue({ ok: true, data: { media: ROW } });

        await api.listMedia({ id: 'l1' });
        await api.addMedia({ id: 'l1', body: { url: 'u', publicId: 'p' } });
        await api.removeMedia({ id: 'l1', mediaId: 'm1' });
        await api.reorderMedia({ id: 'l1', orderedIds: ['m1'] });

        expect(listingMediaApi.listMedia).toHaveBeenCalledWith({ vertical, id: 'l1' });
        expect(listingMediaApi.addMedia).toHaveBeenCalledWith({
            vertical,
            id: 'l1',
            body: { url: 'u', publicId: 'p' }
        });
        expect(listingMediaApi.removeMedia).toHaveBeenCalledWith({
            vertical,
            id: 'l1',
            mediaId: 'm1'
        });
        expect(listingMediaApi.reorderMedia).toHaveBeenCalledWith({
            vertical,
            id: 'l1',
            orderedIds: ['m1']
        });
        for (const fn of Object.values(accommodationMediaApi)) expect(fn).not.toHaveBeenCalled();
    });

    it('reads the vertical allowance and uploads with the vertical as entityType', async () => {
        const api = createListingPhotoApi({ vertical });
        const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });

        await api.getAllowance({ id: 'l1' });
        await api.uploadImage({ file, listingId: 'l1', role: 'featured' });

        expect(getAllowance).toHaveBeenCalledWith({ vertical, id: 'l1' });
        expect(uploadEntityImage).toHaveBeenCalledWith({
            file,
            entityType: vertical,
            entityId: 'l1',
            role: 'featured',
            onProgress: undefined
        });
    });
});

describe('createListingPhotoApi(accommodation)', () => {
    it('routes to the accommodation API and the accommodation allowance', async () => {
        const api = createListingPhotoApi({ vertical: 'accommodation' });

        await api.listMedia({ id: 'a1' });
        await api.getAllowance({ id: 'a1' });

        expect(accommodationMediaApi.listMedia).toHaveBeenCalledWith({ id: 'a1' });
        expect(getAllowance).toHaveBeenCalledWith({ vertical: 'accommodation', id: 'a1' });
        expect(listingMediaApi.listMedia).not.toHaveBeenCalled();
    });

    it('passes a failed result through untouched', async () => {
        const error = {
            status: 403,
            code: 'ENTITLEMENT_REQUIRED',
            message: 'Entitlement required'
        };
        accommodationMediaApi.listMedia.mockResolvedValue({ ok: false, error });

        const result = await createListingPhotoApi({ vertical: 'accommodation' }).listMedia({
            id: 'a1'
        });

        expect(result).toEqual({ ok: false, error });
    });
});

describe('toListingPhotoRow', () => {
    it('reads nullable text fields as undefined and keeps the moderation state', () => {
        expect(toListingPhotoRow(ROW as Parameters<typeof toListingPhotoRow>[0])).toEqual({
            id: 'm1',
            url: 'https://cdn.example.com/m1.jpg',
            publicId: undefined,
            caption: undefined,
            description: 'Vista',
            alt: undefined,
            attribution: null,
            isFeatured: false,
            sortOrder: 1,
            state: 'visible',
            moderationState: 'APPROVED'
        });
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findByAccommodation } = vi.hoisted(() => ({ findByAccommodation: vi.fn() }));

vi.mock('@repo/db', () => ({
    accommodationMediaModel: { findByAccommodation }
}));

import { accommodationGalleryPhotoLimit } from '../../../src/utils/listing-access/photo-limit';

describe('accommodationGalleryPhotoLimit (HOS-2031)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('allows a cover plus 15 gallery photos and rejects the 16th gallery photo', async () => {
        const cover = { id: 'cover', isFeatured: true };
        let rows = [
            cover,
            ...Array.from({ length: 14 }, (_, index) => ({
                id: `gallery-${index}`,
                isFeatured: false
            }))
        ];
        findByAccommodation.mockImplementation(async ({ isFeatured }: { isFeatured: boolean }) => {
            const items = rows.filter((row) => row.isFeatured === isFeatured);
            return { items, total: items.length };
        });

        const galleryWithinCap = await accommodationGalleryPhotoLimit({ listingId: 'listing-id' });
        rows = [
            cover,
            ...Array.from({ length: 15 }, (_, index) => ({
                id: `gallery-${index}`,
                isFeatured: false
            }))
        ];
        const nextGalleryPhoto = await accommodationGalleryPhotoLimit({ listingId: 'listing-id' });

        expect(galleryWithinCap).toEqual({ key: 'max_photos_per_accommodation', requested: 15 });
        expect(nextGalleryPhoto).toEqual({ key: 'max_photos_per_accommodation', requested: 16 });
        expect(findByAccommodation).toHaveBeenNthCalledWith(1, {
            accommodationId: 'listing-id',
            state: 'visible',
            isFeatured: false
        });
    });
});

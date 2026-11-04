import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findByAccommodation } = vi.hoisted(() => ({ findByAccommodation: vi.fn() }));

vi.mock('@repo/db', () => ({
    accommodationMediaModel: { findByAccommodation }
}));

import { accommodationGalleryPhotoLimit } from '../../../src/utils/listing-access/photo-limit';

describe('accommodationGalleryPhotoLimit (HOS-2031)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('allows a cover plus 15 gallery photos and rejects the 16th gallery photo', async () => {
        findByAccommodation
            .mockResolvedValueOnce({ total: 15 })
            .mockResolvedValueOnce({ total: 16 });

        const atCap = await accommodationGalleryPhotoLimit({ listingId: 'listing-id' });
        const overCap = await accommodationGalleryPhotoLimit({ listingId: 'listing-id' });

        expect(atCap).toEqual({ key: 'max_photos_per_accommodation', requested: 16 });
        expect(overCap).toEqual({ key: 'max_photos_per_accommodation', requested: 17 });
        expect(findByAccommodation).toHaveBeenNthCalledWith(1, {
            accommodationId: 'listing-id',
            state: 'visible',
            isFeatured: false
        });
    });
});

import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findByAccommodation, findByVenue, findByExperience } = vi.hoisted(() => ({
    findByAccommodation: vi.fn(),
    findByVenue: vi.fn(),
    findByExperience: vi.fn()
}));

vi.mock('@repo/db', () => ({
    accommodationMediaModel: { findByAccommodation },
    venueMediaModel: { findByVenue },
    experienceMediaModel: { findByExperience }
}));

import {
    accommodationGalleryPhotoLimit,
    countListingGalleryPhotos,
    listingCoverPhotoLimit,
    listingGalleryPhotoLimit
} from '../../../src/utils/listing-access/photo-limit';

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

describe('listing photo limits per vertical (HOS-2495)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('asks for used + 1 on a venue gallery write, counting visible non-featured rows', async () => {
        // Arrange
        findByVenue.mockResolvedValue({ items: [], total: 14 });

        // Act
        const result = await listingGalleryPhotoLimit({ vertical: VerticalEnum.VENUE })({
            listingId: 'venue-1'
        });

        // Assert
        expect(result).toEqual({ key: 'max_photos_per_venue', requested: 15 });
        expect(findByVenue.mock.calls).toEqual([
            [{ venueId: 'venue-1', state: 'visible', isFeatured: false }]
        ]);
        expect(findByAccommodation).not.toHaveBeenCalled();
    });

    it('asks for used + 1 on an experience gallery write', async () => {
        // Arrange
        findByExperience.mockResolvedValue({ items: [], total: 29 });

        // Act
        const result = await listingGalleryPhotoLimit({ vertical: VerticalEnum.EXPERIENCE })({
            listingId: 'exp-1'
        });

        // Assert
        expect(result).toEqual({ key: 'max_photos_per_experience', requested: 30 });
        expect(findByExperience.mock.calls).toEqual([
            [{ experienceId: 'exp-1', state: 'visible', isFeatured: false }]
        ]);
    });

    it.each([
        [VerticalEnum.ACCOMMODATION, 'max_photos_per_accommodation'],
        [VerticalEnum.VENUE, 'max_photos_per_venue'],
        [VerticalEnum.EXPERIENCE, 'max_photos_per_experience']
    ] as const)('asks for exactly 1 on a %s cover write without counting', async (vertical, key) => {
        // Act
        const result = await listingCoverPhotoLimit({ vertical })();

        // Assert
        expect(result).toEqual({ key, requested: 1 });
        expect(findByAccommodation).not.toHaveBeenCalled();
        expect(findByVenue).not.toHaveBeenCalled();
        expect(findByExperience).not.toHaveBeenCalled();
    });

    it('counts the accommodation gallery for the allowance read', async () => {
        // Arrange
        findByAccommodation.mockResolvedValue({ items: [], total: 7 });

        // Act
        const result = await countListingGalleryPhotos({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: 'acc-1'
        });

        // Assert
        expect(result).toEqual({ used: 7 });
    });
});

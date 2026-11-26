/**
 * Public gallery trim of venue and experience listings (HOS-2495 AC-14, AC-16,
 * AC-19, AC-22): the composed `media.gallery` shows its first N items, the
 * cover is never touched, and a failed lookup fails closed to the cover alone.
 */
import { UNLIMITED_LIMIT_VALUE, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ effectiveSet: vi.fn() }));
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));

import { projectPublicListings, trimPublicGallery } from '../../src/utils/public-listing-projector';

const COVER = { url: 'https://cdn.example.com/cover.jpg', moderationState: 'APPROVED' };
const photos = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ url: `https://cdn.example.com/${index}.jpg` }));

function setWith(photoCap: number | undefined) {
    mocks.effectiveSet.mockImplementation(async ({ userId, vertical }) =>
        rehydrateEffectiveSet({
            version: 1,
            userId,
            vertical,
            hasLiveNonTrialTitle: true,
            inheritsTouristVip: false,
            entries:
                photoCap === undefined
                    ? []
                    : [{ key: `max_photos_per_${vertical}`, value: photoCap, strategy: 'SUM' }]
        })
    );
}

const listing = (vertical: 'venue' | 'experience', galleryCount: number) => ({
    id: `${vertical}-1`,
    ownerId: 'owner',
    businessLines: vertical === 'venue' ? ['food'] : ['standard'],
    type: vertical === 'venue' ? 'RESTAURANT' : 'TOUR',
    media: { featuredImage: COVER, gallery: photos(galleryCount), videos: [] }
});

describe.each(['venue', 'experience'] as const)('%s public gallery trim', (vertical) => {
    beforeEach(() => {
        mocks.effectiveSet.mockReset();
    });

    it('shows the first 15 of 20 photos at cap 15 and keeps the cover', async () => {
        // Arrange
        setWith(15);
        const input = listing(vertical, 20);
        const before = structuredClone(input);

        // Act
        const [projected] = await projectPublicListings({ vertical, listings: [input] });

        // Assert
        const media = projected?.media as { featuredImage: unknown; gallery: unknown[] };
        expect(media.gallery).toEqual(photos(15));
        expect(media.featuredImage).toEqual(COVER);
        expect(input).toEqual(before);
    });

    it('shows every photo when the cap is unlimited', async () => {
        // Arrange
        setWith(UNLIMITED_LIMIT_VALUE);

        // Act
        const [projected] = await projectPublicListings({
            vertical,
            listings: [listing(vertical, 70)]
        });

        // Assert
        expect((projected?.media as { gallery: unknown[] }).gallery).toHaveLength(70);
    });

    it('shows the cover alone when the owner holds no photo key (cap 0)', async () => {
        // Arrange
        setWith(undefined);

        // Act
        const [projected] = await projectPublicListings({
            vertical,
            listings: [listing(vertical, 4)]
        });

        // Assert
        const media = projected?.media as { featuredImage: unknown; gallery: unknown[] };
        expect(media.gallery).toEqual([]);
        expect(media.featuredImage).toEqual(COVER);
    });

    it('fails closed to the cover alone and signals no-store when the lookup throws', async () => {
        // Arrange
        mocks.effectiveSet.mockRejectedValue(new Error('redis down'));
        const onEffectiveSetFailure = vi.fn();

        // Act
        const [projected] = await projectPublicListings({
            vertical,
            listings: [listing(vertical, 4)],
            onEffectiveSetFailure
        });

        // Assert
        const media = projected?.media as { featuredImage: unknown; gallery: unknown[] };
        expect(media.gallery).toEqual([]);
        expect(media.featuredImage).toEqual(COVER);
        expect(onEffectiveSetFailure).toHaveBeenCalledTimes(1);
    });
});

describe('trimPublicGallery', () => {
    const empty = rehydrateEffectiveSet({
        version: 1,
        userId: 'owner',
        vertical: VerticalEnum.VENUE,
        hasLiveNonTrialTitle: false,
        inheritsTouristVip: false,
        entries: []
    });

    it.each([
        [{ id: '1' }],
        [{ id: '1', media: null }],
        [{ id: '1', media: { featuredImage: COVER } }]
    ])('leaves a listing without a gallery array unchanged (%o)', (input) => {
        expect(
            trimPublicGallery({
                vertical: 'venue',
                listing: input,
                ownerId: 'owner',
                effective: empty
            })
        ).toBe(input);
    });
});

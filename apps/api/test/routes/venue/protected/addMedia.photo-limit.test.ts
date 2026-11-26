/**
 * Step 7 on the venue and experience protected media writes (HOS-2495 AC-2,
 * AC-3, AC-19).
 *
 * The service helpers are mocked so the assertions are about what the
 * listing-access middleware lets through: a gallery write asks for
 * `visible non-featured + 1` on the vertical's photo key, a cover write asks for
 * exactly 1. The owner's effective set grants 15.
 *
 * @module test/routes/venue/protected/addMedia.photo-limit
 */
import { experienceMediaModel, venueMediaModel } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockAddVenueMedia,
    mockAddVenueFeaturedMedia,
    mockAddExperienceMedia,
    mockAddExperienceFeaturedMedia,
    photoCap
} = vi.hoisted(() => ({
    mockAddVenueMedia: vi.fn(),
    mockAddVenueFeaturedMedia: vi.fn(),
    mockAddExperienceMedia: vi.fn(),
    mockAddExperienceFeaturedMedia: vi.fn(),
    photoCap: { value: 15 }
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        addVenueMedia: mockAddVenueMedia,
        addVenueFeaturedMedia: mockAddVenueFeaturedMedia,
        addExperienceMedia: mockAddExperienceMedia,
        addExperienceFeaturedMedia: mockAddExperienceFeaturedMedia
    };
});

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LISTING_ID = '00000000-0000-4000-8000-000000000001';

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: async () => ({
            facts: { ownerId: OWNER_ID, publicationStatus: PublicationStatusEnum.PUBLISHED },
            ownerId: OWNER_ID
        }),
        billing: { coverage: async () => ({ covered: true, sources: [{ type: 'BASE' }] }) },
        effectiveSet: async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: true,
                inheritsTouristVip: false,
                entries: [
                    { key: `edit_${vertical}_info`, value: 1, strategy: 'MAX' },
                    { key: `max_photos_per_${vertical}`, value: photoCap.value, strategy: 'SUM' }
                ]
            })
    })
}));

import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const AUTH_HEADERS = {
    'Content-Type': 'application/json',
    'user-agent': 'vitest',
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'HOST',
    'x-mock-actor-permissions': JSON.stringify(['venue.editOwn', 'experience.editOwn'])
};

const BODY = {
    url: 'https://res.cloudinary.com/demo/image/upload/photo.jpg',
    publicId: 'hospeda/dev/photo',
    alt: 'Salón principal con mesas'
};

const CASES = [
    {
        vertical: VerticalEnum.VENUE,
        base: `/api/v1/protected/venues/${LISTING_ID}/media`,
        key: 'max_photos_per_venue',
        gallery: mockAddVenueMedia,
        cover: mockAddVenueFeaturedMedia,
        count: () => vi.mocked(venueMediaModel.findByVenue)
    },
    {
        vertical: VerticalEnum.EXPERIENCE,
        base: `/api/v1/protected/experiences/${LISTING_ID}/media`,
        key: 'max_photos_per_experience',
        gallery: mockAddExperienceMedia,
        cover: mockAddExperienceFeaturedMedia,
        count: () => vi.mocked(experienceMediaModel.findByExperience)
    }
] as const;

describe.each(CASES)('$vertical protected media writes run step 7 (HOS-2495)', (c) => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        photoCap.value = 15;
        app = initApp();
        c.gallery.mockResolvedValue({ data: { id: 'media-1' }, error: undefined });
        c.cover.mockResolvedValue({
            data: { media: { id: 'cover-1' }, previousFeatured: null },
            error: undefined
        });
    });

    const post = (path: string) =>
        app.request(path, { method: 'POST', headers: AUTH_HEADERS, body: JSON.stringify(BODY) });

    it('stores the 15th gallery photo when 14 are visible', async () => {
        // Arrange
        c.count().mockResolvedValue({ items: [], total: 14 } as never);

        // Act
        await post(c.base);

        // Assert
        expect(c.gallery).toHaveBeenCalledTimes(1);
        expect(c.count().mock.calls[0]?.[0]).toEqual(
            c.vertical === VerticalEnum.VENUE
                ? { venueId: LISTING_ID, state: 'visible', isFeatured: false }
                : { experienceId: LISTING_ID, state: 'visible', isFeatured: false }
        );
    });

    it('refuses the 16th gallery photo with 403 LIMIT_REACHED and never reaches the service', async () => {
        // Arrange
        c.count().mockResolvedValue({ items: [], total: 15 } as never);

        // Act
        const res = await post(c.base);
        const body = await res.json();

        // Assert
        expect(res.status).toBe(403);
        expect(body.error.code).toBe('LIMIT_REACHED');
        expect(body.error.details).toEqual({
            limitKey: c.key,
            currentCount: 15,
            maxAllowed: 15
        });
        expect(c.gallery).not.toHaveBeenCalled();
    });

    it('accepts a cover with a full gallery because the cover asks for 1', async () => {
        // Arrange
        c.count().mockResolvedValue({ items: [], total: 15 } as never);

        // Act
        await post(`${c.base}/featured`);

        // Assert
        expect(c.cover).toHaveBeenCalledTimes(1);
        expect(c.count()).not.toHaveBeenCalled();
    });

    it('refuses a cover when the cap is 0 (requested: 1)', async () => {
        // Arrange
        photoCap.value = 0;

        // Act
        const res = await post(`${c.base}/featured`);
        const body = await res.json();

        // Assert
        expect(res.status).toBe(403);
        expect(body.error.code).toBe('LIMIT_REACHED');
        expect(body.error.details).toEqual({ limitKey: c.key, currentCount: 0, maxAllowed: 0 });
        expect(c.cover).not.toHaveBeenCalled();
    });
});

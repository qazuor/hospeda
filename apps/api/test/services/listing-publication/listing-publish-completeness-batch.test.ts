/**
 * HOS-2331 — `evaluateListingsPublishCompleteness`, the batch twin of the
 * publish-button evaluator: the same rules over many listings, with ONE media
 * query per vertical however many listings there are (AC-C32).
 *
 * The media models come from the global `@repo/db` mock (`test/setup.ts`); the
 * rules themselves are the real `@repo/schemas` functions.
 *
 * @module test/services/listing-publication/listing-publish-completeness-batch
 */

import { accommodationMediaModel, experienceMediaModel, venueMediaModel } from '@repo/db';
import { type Accommodation, type Experience, type Venue, VerticalEnum } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateListingPublishCompleteness } from '../../../src/services/listing-publication/listing-publish-completeness';
import { evaluateListingsPublishCompleteness } from '../../../src/services/listing-publication/listing-publish-completeness-batch';

const OWNER = '1f2e3d4c-5b6a-4789-8abc-def012345678';
const DESTINATION = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';

const idOf = (n: number): string => `a${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`;

/** A featured, approved media row, as the media tables store it. */
const featuredRow = (listingId: string) => ({
    id: `m-${listingId}`,
    accommodationId: listingId,
    venueId: listingId,
    experienceId: listingId,
    url: `https://example.com/${listingId}.jpg`,
    isFeatured: true,
    state: 'visible',
    moderationState: 'APPROVED',
    sortOrder: 0,
    deletedAt: null
});

/** An accommodation complete except, optionally, its photo. */
const accommodation = (id: string): Accommodation =>
    ({
        id,
        ownerId: OWNER,
        description: 'Una casa amplia frente al río con todo lo necesario.',
        extraInfo: { capacity: 4, bedrooms: 2, bathrooms: 1 },
        policies: { minNights: 2 },
        videos: null
    }) as unknown as Accommodation;

/** A venue complete except, optionally, its photo. */
const venue = (id: string): Venue =>
    ({
        id,
        ownerId: OWNER,
        destinationId: DESTINATION,
        name: 'La Parrilla',
        summary: 'Parrilla de barrio con patio.',
        description: 'Una parrilla tradicional con patio, cortes a la leña y postres caseros.',
        type: 'RESTAURANT',
        businessLines: ['standard'],
        contactInfo: { mobilePhone: '+5493442000000' },
        openingHours: { days: { mon: { shifts: [{ open: '12:00', close: '15:00' }] } } },
        priceRange: '$$'
    }) as unknown as Venue;

describe('evaluateListingsPublishCompleteness', () => {
    afterEach(() => {
        vi.mocked(accommodationMediaModel.findByAccommodations).mockReset();
        vi.mocked(venueMediaModel.findByVenues).mockReset();
        vi.mocked(experienceMediaModel.findByExperiences).mockReset();
    });

    it('reads accommodation media ONCE for any number of listings and reports only the incomplete ones', async () => {
        // Arrange: 30 accommodations, only the even ones have a main photo
        const listings = Array.from({ length: 30 }, (_, n) => accommodation(idOf(n)));
        vi.mocked(accommodationMediaModel.findByAccommodations).mockResolvedValue(
            new Map(
                listings
                    .filter((_, n) => n % 2 === 0)
                    .map((listing) => [listing.id, [featuredRow(listing.id)]])
            ) as never
        );

        // Act
        const result = await evaluateListingsPublishCompleteness({
            vertical: VerticalEnum.ACCOMMODATION,
            listings
        });

        // Assert
        expect(accommodationMediaModel.findByAccommodations).toHaveBeenCalledTimes(1);
        expect(accommodationMediaModel.findByAccommodations).toHaveBeenCalledWith({
            accommodationIds: listings.map((listing) => listing.id)
        });
        expect(result.size).toBe(15);
        expect(result.get(idOf(1))).toEqual(['mainImage']);
        expect(result.has(idOf(0))).toBe(false);
    });

    it('reports every unmet accommodation requirement in rule order', async () => {
        // Arrange: an accommodation missing its capacity and its photo
        const listing = {
            ...accommodation(idOf(1)),
            extraInfo: { bedrooms: 2, bathrooms: 1 }
        } as unknown as Accommodation;
        vi.mocked(accommodationMediaModel.findByAccommodations).mockResolvedValue(new Map());

        // Act
        const result = await evaluateListingsPublishCompleteness({
            vertical: VerticalEnum.ACCOMMODATION,
            listings: [listing]
        });

        // Assert
        expect(result.get(listing.id)).toEqual(['capacity', 'mainImage']);
    });

    it('agrees with the single-listing evaluator for venues', async () => {
        // Arrange: a venue with no photo and no price range
        const listing = { ...venue(idOf(1)), priceRange: null } as unknown as Venue;
        vi.mocked(venueMediaModel.findByVenues).mockResolvedValue(new Map());

        // Act
        const batch = await evaluateListingsPublishCompleteness({
            vertical: VerticalEnum.VENUE,
            listings: [listing]
        });
        const single = await evaluateListingPublishCompleteness({
            vertical: VerticalEnum.VENUE,
            listing,
            media: {}
        });

        // Assert
        expect(single.missing.length).toBeGreaterThan(0);
        expect(batch.get(listing.id)).toEqual(single.missing);
    });

    it('reads venue media ONCE and judges each venue with its own composed media', async () => {
        // Arrange
        const listings = Array.from({ length: 12 }, (_, n) => venue(idOf(n)));
        vi.mocked(venueMediaModel.findByVenues).mockResolvedValue(
            new Map([[idOf(3), [featuredRow(idOf(3))]]]) as never
        );

        // Act
        const result = await evaluateListingsPublishCompleteness({
            vertical: VerticalEnum.VENUE,
            listings
        });

        // Assert
        expect(venueMediaModel.findByVenues).toHaveBeenCalledTimes(1);
        expect(result.has(idOf(3))).toBe(false);
        expect(result.get(idOf(0))).toEqual(['media.featuredImage']);
        expect(result.size).toBe(11);
    });

    it('reads the experience media table for experiences', async () => {
        // Arrange
        const listing = { ...venue(idOf(1)), type: 'TOUR_GUIDE' } as unknown as Experience;
        vi.mocked(experienceMediaModel.findByExperiences).mockResolvedValue(new Map());

        // Act
        const result = await evaluateListingsPublishCompleteness({
            vertical: VerticalEnum.EXPERIENCE,
            listings: [listing]
        });

        // Assert
        expect(experienceMediaModel.findByExperiences).toHaveBeenCalledTimes(1);
        expect(venueMediaModel.findByVenues).not.toHaveBeenCalled();
        expect(result.get(listing.id)).toContain('media.featuredImage');
    });

    it('makes no query for an empty list', async () => {
        // Act
        const result = await evaluateListingsPublishCompleteness({
            vertical: VerticalEnum.VENUE,
            listings: []
        });

        // Assert
        expect(result.size).toBe(0);
        expect(venueMediaModel.findByVenues).not.toHaveBeenCalled();
    });

    it('propagates a media read failure instead of reporting "no photos"', async () => {
        // Arrange
        vi.mocked(venueMediaModel.findByVenues).mockRejectedValue(new Error('db down'));

        // Act / Assert
        await expect(
            evaluateListingsPublishCompleteness({
                vertical: VerticalEnum.VENUE,
                listings: [venue(idOf(1))]
            })
        ).rejects.toThrow('db down');
    });
});

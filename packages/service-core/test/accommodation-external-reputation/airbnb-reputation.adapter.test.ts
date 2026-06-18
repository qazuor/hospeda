/**
 * Unit tests for AirbnbReputationAdapter (SPEC-237 T-006)
 *
 * Key assertions:
 * - AC-7.1 legal guard: `snippets` is ALWAYS `null` even when the Apify
 *   actor payload contains review text / snippet data.
 * - Credential degradation: missing apifyToken or apifyAirbnbActor → degrade.
 * - Rating and reviewsCount are mapped from various actor field names.
 * - Empty actor dataset → degrade.
 * - Never throws.
 */

import { ExternalPlatformEnum, LifecycleStatusEnum } from '@repo/schemas';
import type { AccommodationExternalListing } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AirbnbReputationAdapter } from '../../src/services/accommodation-external-reputation/adapters/airbnb-reputation.adapter.js';

// ---------------------------------------------------------------------------
// Mock runApifyActor
// ---------------------------------------------------------------------------

const { mockRunApifyActor } = vi.hoisted(() => ({
    mockRunApifyActor: vi.fn()
}));

vi.mock('../../src/services/accommodation-import/adapters/apify-client.js', () => ({
    runApifyActor: mockRunApifyActor
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAirbnbListing(
    overrides: Partial<AccommodationExternalListing> = {}
): AccommodationExternalListing {
    return {
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        accommodationId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        platform: ExternalPlatformEnum.AIRBNB,
        url: 'https://www.airbnb.com/rooms/12345678',
        externalId: null,
        showLink: false,
        showReviews: false,
        verified: true,
        createdById: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        updatedById: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        deletedById: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        deletedAt: null,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
    vi.clearAllMocks();
});

describe('AirbnbReputationAdapter', () => {
    describe('AC-7.1 legal guard — snippets must ALWAYS be null', () => {
        it('should return snippets:null even when Apify dataset includes review text', async () => {
            // Arrange: Apify returns a payload containing review text and a reviews list
            const adapter = new AirbnbReputationAdapter({
                apifyToken: 'apify_tok',
                apifyAirbnbActor: 'dtrungtin/airbnb-scraper'
            });
            const listing = makeAirbnbListing();

            // Apify dataset WITH review text — must be stripped by the adapter
            mockRunApifyActor.mockResolvedValueOnce([
                {
                    rating: 4.8,
                    reviewsCount: 95,
                    // These fields MUST NOT appear in the result:
                    reviews: [
                        {
                            author: 'Carlos M.',
                            text: 'Perfect location and great host!',
                            rating: 5,
                            createdAt: '2024-02-10'
                        },
                        {
                            author: 'Laura P.',
                            text: 'Very clean and comfortable.',
                            rating: 5
                        }
                    ],
                    reviewsList: [{ text: 'Would come again!' }],
                    guestReviews: 'Many positive reviews'
                }
            ]);

            // Act
            const result = await adapter.fetch(listing);

            // Assert: snippets stripped regardless of source payload
            expect(result.snippets).toBeNull();
        });

        it('should return snippets:null when Apify dataset uses alternative review field names', async () => {
            const adapter = new AirbnbReputationAdapter({
                apifyToken: 'tok',
                apifyAirbnbActor: 'maxcopell/airbnb-scraper'
            });
            const listing = makeAirbnbListing();

            mockRunApifyActor.mockResolvedValueOnce([
                {
                    starRating: 4.6,
                    numberOfReviews: 200,
                    // Alternative review field names that must not leak
                    reviewText: 'Nice apartment',
                    comments: [{ text: 'Loved the balcony' }]
                }
            ]);

            const result = await adapter.fetch(listing);

            expect(result.snippets).toBeNull();
        });
    });

    describe('credential degradation', () => {
        it('should return all-null result when apifyToken is absent', async () => {
            const adapter = new AirbnbReputationAdapter({
                apifyAirbnbActor: 'dtrungtin/airbnb-scraper'
            });
            const listing = makeAirbnbListing();

            const result = await adapter.fetch(listing);

            expect(mockRunApifyActor).not.toHaveBeenCalled();
            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
            expect(result.deepLink).toBeNull();
            expect(result.snippets).toBeNull();
        });

        it('should return all-null result when apifyAirbnbActor is absent', async () => {
            const adapter = new AirbnbReputationAdapter({ apifyToken: 'tok' });
            const listing = makeAirbnbListing();

            const result = await adapter.fetch(listing);

            expect(mockRunApifyActor).not.toHaveBeenCalled();
            expect(result.rating).toBeNull();
            expect(result.snippets).toBeNull();
        });

        it('should return all-null result when both credentials are absent', async () => {
            const adapter = new AirbnbReputationAdapter({});
            const listing = makeAirbnbListing();

            const result = await adapter.fetch(listing);

            expect(mockRunApifyActor).not.toHaveBeenCalled();
            expect(result.rating).toBeNull();
        });
    });

    describe('rating and reviewsCount mapping', () => {
        it('should map rating from the `rating` field', async () => {
            const adapter = new AirbnbReputationAdapter({
                apifyToken: 'tok',
                apifyAirbnbActor: 'dtrungtin/airbnb-scraper'
            });
            const listing = makeAirbnbListing();

            mockRunApifyActor.mockResolvedValueOnce([{ rating: 4.9, reviewsCount: 50 }]);

            const result = await adapter.fetch(listing);

            expect(result.rating).toBe(4.9);
            expect(result.reviewsCount).toBe(50);
        });

        it('should fall back to starRating when rating is absent', async () => {
            const adapter = new AirbnbReputationAdapter({
                apifyToken: 'tok',
                apifyAirbnbActor: 'actor/slug'
            });
            const listing = makeAirbnbListing();

            mockRunApifyActor.mockResolvedValueOnce([{ starRating: 4.5, numberOfReviews: 30 }]);

            const result = await adapter.fetch(listing);

            expect(result.rating).toBe(4.5);
            expect(result.reviewsCount).toBe(30);
        });

        it('should fall back to guestSatisfactionOverall when rating/starRating absent', async () => {
            const adapter = new AirbnbReputationAdapter({
                apifyToken: 'tok',
                apifyAirbnbActor: 'actor/slug'
            });
            const listing = makeAirbnbListing();

            mockRunApifyActor.mockResolvedValueOnce([
                { guestSatisfactionOverall: 97, reviewCount: 80 }
            ]);

            const result = await adapter.fetch(listing);

            expect(result.rating).toBe(97);
        });

        it('should use listing.url as deepLink when item has no url', async () => {
            const adapter = new AirbnbReputationAdapter({
                apifyToken: 'tok',
                apifyAirbnbActor: 'actor/slug'
            });
            const listing = makeAirbnbListing();

            mockRunApifyActor.mockResolvedValueOnce([{ rating: 4.7, reviewsCount: 20 }]);

            const result = await adapter.fetch(listing);

            expect(result.deepLink).toBe(listing.url);
        });

        it('should use item.url as deepLink when present', async () => {
            const adapter = new AirbnbReputationAdapter({
                apifyToken: 'tok',
                apifyAirbnbActor: 'actor/slug'
            });
            const listing = makeAirbnbListing();
            const itemUrl = 'https://www.airbnb.com/rooms/12345678?check_in=2024-05-01';

            mockRunApifyActor.mockResolvedValueOnce([
                { rating: 4.7, reviewsCount: 20, url: itemUrl }
            ]);

            const result = await adapter.fetch(listing);

            expect(result.deepLink).toBe(itemUrl);
        });
    });

    describe('empty / error cases', () => {
        it('should return all-null result when Apify returns empty dataset', async () => {
            const adapter = new AirbnbReputationAdapter({
                apifyToken: 'tok',
                apifyAirbnbActor: 'actor/slug'
            });
            const listing = makeAirbnbListing();

            mockRunApifyActor.mockResolvedValueOnce([]);

            const result = await adapter.fetch(listing);

            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
            expect(result.snippets).toBeNull();
        });

        it('should return all-null result without throwing on unexpected error', async () => {
            const adapter = new AirbnbReputationAdapter({
                apifyToken: 'tok',
                apifyAirbnbActor: 'actor/slug'
            });
            const listing = makeAirbnbListing();

            mockRunApifyActor.mockRejectedValueOnce(new Error('network failure'));

            await expect(adapter.fetch(listing)).resolves.toMatchObject({
                rating: null,
                reviewsCount: null,
                snippets: null
            });
        });
    });
});

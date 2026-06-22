/**
 * Unit tests for AirbnbReputationAdapter (SPEC-237 T-006, updated SPEC-250)
 *
 * Key assertions:
 * - AC-7.1 legal guard: `snippets` is ALWAYS `null` even when the Apify
 *   actor payload contains review text / snippet data.
 * - `fetch()` always returns all-null (Airbnb has no fast inline path).
 * - `startRun()`: calls startApifyRun with correct input; maps run/dataset IDs.
 * - `startRun()` degrades to null when credentials absent or startApifyRun returns null.
 * - `mapDatasetItems()`: pure mapping for representative Airbnb dataset items.
 * - Never throws.
 */

import { ExternalPlatformEnum, LifecycleStatusEnum } from '@repo/schemas';
import type { AccommodationExternalListing } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AirbnbReputationAdapter } from '../../src/services/accommodation-external-reputation/adapters/airbnb-reputation.adapter.js';

// ---------------------------------------------------------------------------
// Mock startApifyRun
// ---------------------------------------------------------------------------

const { mockStartApifyRun } = vi.hoisted(() => ({
    mockStartApifyRun: vi.fn()
}));

vi.mock('../../src/services/accommodation-import/adapters/apify-client.js', () => ({
    startApifyRun: mockStartApifyRun
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
    describe('fetch() — always returns all-null (no inline path for Airbnb)', () => {
        it('should return all-null result without making any network call', async () => {
            // Arrange
            const adapter = new AirbnbReputationAdapter({
                apifyToken: 'apify_tok',
                apifyAirbnbActor: 'dtrungtin/airbnb-scraper'
            });
            const listing = makeAirbnbListing();

            // Act
            const result = await adapter.fetch(listing);

            // Assert: always empty — no network call, no startApifyRun from fetch()
            expect(mockStartApifyRun).not.toHaveBeenCalled();
            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
            expect(result.deepLink).toBeNull();
            expect(result.snippets).toBeNull();
        });

        it('should return all-null even when credentials are absent', async () => {
            // Arrange
            const adapter = new AirbnbReputationAdapter({});
            const listing = makeAirbnbListing();

            // Act
            const result = await adapter.fetch(listing);

            // Assert
            expect(result.rating).toBeNull();
            expect(result.snippets).toBeNull();
        });
    });

    describe('startRun() — Phase A async enqueue', () => {
        it('should call startApifyRun with correct actor input and return runId + datasetId', async () => {
            // Arrange
            const adapter = new AirbnbReputationAdapter({
                apifyToken: 'apify_tok',
                apifyAirbnbActor: 'dtrungtin/airbnb-scraper'
            });
            const listing = makeAirbnbListing();

            mockStartApifyRun.mockResolvedValueOnce({
                runId: 'run-airbnb-111',
                defaultDatasetId: 'ds-airbnb-222'
            });

            // Act
            const result = await adapter.startRun(listing);

            // Assert
            expect(mockStartApifyRun).toHaveBeenCalledOnce();
            expect(mockStartApifyRun).toHaveBeenCalledWith({
                token: 'apify_tok',
                actor: 'dtrungtin/airbnb-scraper',
                actorInput: { startUrls: [{ url: listing.url }] }
            });
            expect(result).toEqual({ runId: 'run-airbnb-111', datasetId: 'ds-airbnb-222' });
        });

        it('should return null when apifyToken is absent', async () => {
            // Arrange
            const adapter = new AirbnbReputationAdapter({
                apifyAirbnbActor: 'dtrungtin/airbnb-scraper'
            });
            const listing = makeAirbnbListing();

            // Act
            const result = await adapter.startRun(listing);

            // Assert
            expect(mockStartApifyRun).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });

        it('should return null when apifyAirbnbActor is absent', async () => {
            // Arrange
            const adapter = new AirbnbReputationAdapter({ apifyToken: 'tok' });
            const listing = makeAirbnbListing();

            // Act
            const result = await adapter.startRun(listing);

            // Assert
            expect(mockStartApifyRun).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });

        it('should return null when both credentials are absent', async () => {
            // Arrange
            const adapter = new AirbnbReputationAdapter({});
            const listing = makeAirbnbListing();

            // Act
            const result = await adapter.startRun(listing);

            // Assert
            expect(mockStartApifyRun).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });

        it('should return null when startApifyRun returns null (Apify API error)', async () => {
            // Arrange
            const adapter = new AirbnbReputationAdapter({
                apifyToken: 'tok',
                apifyAirbnbActor: 'actor/slug'
            });
            const listing = makeAirbnbListing();

            mockStartApifyRun.mockResolvedValueOnce(null);

            // Act
            const result = await adapter.startRun(listing);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('mapDatasetItems() — Phase B pure mapping', () => {
        describe('AC-7.1 legal guard — snippets must ALWAYS be null', () => {
            it('should return snippets:null even when dataset item includes review text', () => {
                // Arrange
                const adapter = new AirbnbReputationAdapter({});
                const listing = makeAirbnbListing();
                const items = [
                    {
                        rating: 4.8,
                        reviewsCount: 95,
                        // These fields MUST NOT appear in the result:
                        reviews: [
                            { author: 'Carlos M.', text: 'Perfect location!', rating: 5 },
                            { author: 'Laura P.', text: 'Very clean.', rating: 5 }
                        ],
                        reviewsList: [{ text: 'Would come again!' }],
                        guestReviews: 'Many positive reviews'
                    }
                ];

                // Act
                const result = adapter.mapDatasetItems(items, listing);

                // Assert
                expect(result.snippets).toBeNull();
            });
        });

        describe('rating and reviewsCount mapping', () => {
            it('should map rating from the flat `rating` field', () => {
                // Arrange
                const adapter = new AirbnbReputationAdapter({});
                const listing = makeAirbnbListing();
                const items = [{ rating: 4.9, reviewsCount: 50 }];

                // Act
                const result = adapter.mapDatasetItems(items, listing);

                // Assert
                expect(result.rating).toBe(4.9);
                expect(result.reviewsCount).toBe(50);
            });

            it('should map from a nested rating object (tri_angle/airbnb-rooms-urls-scraper)', () => {
                // The rooms-urls scraper returns the aggregate as a nested object:
                // { guestSatisfaction, reviewsCount, accuracy, ... }. Only the
                // aggregate sub-fields are read (no review text — AC-7.1).
                const adapter = new AirbnbReputationAdapter({});
                const listing = makeAirbnbListing();
                const items = [
                    {
                        rating: {
                            guestSatisfaction: 5,
                            reviewsCount: 9,
                            accuracy: 5,
                            cleanliness: 4.67
                        }
                    }
                ];

                // Act
                const result = adapter.mapDatasetItems(items, listing);

                // Assert
                expect(result.rating).toBe(5);
                expect(result.reviewsCount).toBe(9);
                expect(result.snippets).toBeNull();
            });

            it('should fall back to starRating when rating is absent', () => {
                // Arrange
                const adapter = new AirbnbReputationAdapter({});
                const listing = makeAirbnbListing();
                const items = [{ starRating: 4.5, numberOfReviews: 30 }];

                // Act
                const result = adapter.mapDatasetItems(items, listing);

                // Assert
                expect(result.rating).toBe(4.5);
                expect(result.reviewsCount).toBe(30);
            });

            it('should fall back to guestSatisfactionOverall when rating/starRating absent', () => {
                // Arrange
                const adapter = new AirbnbReputationAdapter({});
                const listing = makeAirbnbListing();
                const items = [{ guestSatisfactionOverall: 97, reviewCount: 80 }];

                // Act
                const result = adapter.mapDatasetItems(items, listing);

                // Assert
                expect(result.rating).toBe(97);
            });

            it('should prefer nested reviewsCount over flat field', () => {
                // Arrange: tri_angle actor has nested reviewsCount under `rating`
                const adapter = new AirbnbReputationAdapter({});
                const listing = makeAirbnbListing();
                const items = [
                    {
                        rating: { guestSatisfaction: 4.8, reviewsCount: 42 },
                        reviewsCount: 999 // top-level should be secondary
                    }
                ];

                // Act
                const result = adapter.mapDatasetItems(items, listing);

                // Assert: nested wins
                expect(result.reviewsCount).toBe(42);
            });

            it('should use listing.url as deepLink when item has no url', () => {
                // Arrange
                const adapter = new AirbnbReputationAdapter({});
                const listing = makeAirbnbListing();
                const items = [{ rating: 4.7, reviewsCount: 20 }];

                // Act
                const result = adapter.mapDatasetItems(items, listing);

                // Assert
                expect(result.deepLink).toBe(listing.url);
            });

            it('should use item.url as deepLink when present', () => {
                // Arrange
                const adapter = new AirbnbReputationAdapter({});
                const listing = makeAirbnbListing();
                const itemUrl = 'https://www.airbnb.com/rooms/12345678?check_in=2024-05-01';
                const items = [{ rating: 4.7, reviewsCount: 20, url: itemUrl }];

                // Act
                const result = adapter.mapDatasetItems(items, listing);

                // Assert
                expect(result.deepLink).toBe(itemUrl);
            });
        });

        describe('empty / error cases', () => {
            it('should return all-null when items array is empty', () => {
                // Arrange
                const adapter = new AirbnbReputationAdapter({});
                const listing = makeAirbnbListing();

                // Act
                const result = adapter.mapDatasetItems([], listing);

                // Assert
                expect(result.rating).toBeNull();
                expect(result.reviewsCount).toBeNull();
                expect(result.deepLink).toBeNull();
                expect(result.snippets).toBeNull();
            });

            it('should return null rating for non-numeric string', () => {
                // Arrange
                const adapter = new AirbnbReputationAdapter({});
                const listing = makeAirbnbListing();
                const items = [{ rating: 'not-a-number', reviewsCount: 10 }];

                // Act
                const result = adapter.mapDatasetItems(items, listing);

                // Assert
                expect(result.rating).toBeNull();
                expect(result.reviewsCount).toBe(10);
            });

            it('should return null rating and reviewsCount when all fields absent', () => {
                // Arrange
                const adapter = new AirbnbReputationAdapter({});
                const listing = makeAirbnbListing();
                const items = [{ url: 'https://www.airbnb.com/rooms/99999' }];

                // Act
                const result = adapter.mapDatasetItems(items, listing);

                // Assert
                expect(result.rating).toBeNull();
                expect(result.reviewsCount).toBeNull();
            });
        });
    });
});

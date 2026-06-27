/**
 * Unit tests for BookingReputationAdapter (SPEC-237 T-006, updated SPEC-250)
 *
 * Key assertions:
 * - AC-7.1 legal guard: `snippets` is ALWAYS `null` even when the source
 *   payload contains review text / snippet data.
 * - JSON-LD primary path: parses `aggregateRating` from embedded LD+JSON.
 * - JSON-LD miss: `fetch()` returns all-null (service goes async via startRun).
 * - `startRun()`: calls startApifyRun with correct input; maps run/dataset IDs.
 * - `startRun()` degrades to null when startApifyRun returns null or credentials absent.
 * - `mapDatasetItems()`: pure mapping for representative Booking dataset items.
 * - Never throws.
 */

import { ExternalPlatformEnum, LifecycleStatusEnum } from '@repo/schemas';
import type { AccommodationExternalListing } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingReputationAdapter } from '../../src/services/accommodation-external-reputation/adapters/booking-reputation.adapter.js';

// ---------------------------------------------------------------------------
// Mock safeExternalFetch and startApifyRun
// ---------------------------------------------------------------------------

const { mockSafeExternalFetch, mockStartApifyRun } = vi.hoisted(() => ({
    mockSafeExternalFetch: vi.fn(),
    mockStartApifyRun: vi.fn()
}));

vi.mock('@repo/utils/safe-fetch', () => ({
    safeExternalFetch: mockSafeExternalFetch
}));

vi.mock('../../src/services/accommodation-import/adapters/apify-client.js', () => ({
    startApifyRun: mockStartApifyRun
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBookingListing(
    overrides: Partial<AccommodationExternalListing> = {}
): AccommodationExternalListing {
    return {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        accommodationId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        platform: ExternalPlatformEnum.BOOKING,
        url: 'https://www.booking.com/hotel/ar/test-hotel.html',
        externalId: null,
        showLink: false,
        showReviews: false,
        verified: true,
        createdById: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        updatedById: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        deletedById: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        deletedAt: null,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        ...overrides
    };
}

/**
 * Builds an HTML page body containing a JSON-LD block with aggregateRating.
 * Optionally includes review text in the JSON-LD to verify AC-7.1 stripping.
 */
function makeHtmlWithJsonLd(options: {
    ratingValue?: number;
    reviewCount?: number;
    includeReviewText?: boolean;
}): string {
    const { ratingValue = 8.5, reviewCount = 250, includeReviewText = false } = options;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Hotel',
        name: 'Test Hotel',
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue,
            reviewCount,
            bestRating: 10,
            worstRating: 1
        },
        ...(includeReviewText
            ? {
                  review: [
                      {
                          '@type': 'Review',
                          author: { '@type': 'Person', name: 'Guest A' },
                          reviewBody: 'Amazing place to stay! Highly recommend.',
                          reviewRating: { ratingValue: 9 }
                      }
                  ]
              }
            : {})
    };

    return `<!DOCTYPE html><html><body>
        <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
        <h1>Test Hotel</h1>
    </body></html>`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
    vi.clearAllMocks();
});

describe('BookingReputationAdapter', () => {
    describe('AC-7.1 legal guard — snippets must ALWAYS be null', () => {
        it('should return snippets:null when JSON-LD source includes review text', async () => {
            // Arrange: HTML with both aggregateRating AND embedded review text
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: makeHtmlWithJsonLd({ includeReviewText: true }),
                finalUrl: listing.url
            });

            // Act
            const result = await adapter.fetch(listing);

            // Assert: snippets stripped even though source had review text
            expect(result.snippets).toBeNull();
        });

        it('should return snippets:null from mapDatasetItems even when item has review data', () => {
            // Arrange: dataset item includes review-text fields — must be stripped
            const adapter = new BookingReputationAdapter({
                apifyToken: 'tok',
                apifyBookingActor: 'apify/booking-scraper'
            });
            const listing = makeBookingListing();

            const items = [
                {
                    rating: 8.8,
                    reviewsCount: 300,
                    url: 'https://www.booking.com/hotel/ar/test.html',
                    // These fields MUST NOT appear in the result:
                    reviewText: 'Absolutely wonderful stay!',
                    reviewsList: [{ author: 'Guest B', text: 'Great location!', rating: 9 }]
                }
            ];

            // Act
            const result = adapter.mapDatasetItems(items, listing);

            // Assert
            expect(result.snippets).toBeNull();
        });
    });

    describe('primary path — JSON-LD aggregateRating', () => {
        it('should parse rating and reviewsCount from JSON-LD', async () => {
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: makeHtmlWithJsonLd({ ratingValue: 9.2, reviewCount: 1048 }),
                finalUrl: listing.url
            });

            const result = await adapter.fetch(listing);

            expect(result.rating).toBe(9.2);
            expect(result.reviewsCount).toBe(1048);
            expect(result.deepLink).toBe(listing.url);
            expect(result.snippets).toBeNull();
        });

        it('should NOT call startApifyRun when JSON-LD provides sufficient data', async () => {
            const adapter = new BookingReputationAdapter({
                apifyToken: 'tok',
                apifyBookingActor: 'apify/booking-scraper'
            });
            const listing = makeBookingListing();

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: makeHtmlWithJsonLd({ ratingValue: 8.5, reviewCount: 200 }),
                finalUrl: listing.url
            });

            await adapter.fetch(listing);

            expect(mockStartApifyRun).not.toHaveBeenCalled();
        });
    });

    describe('fetch() JSON-LD miss — returns all-null for service async fallthrough', () => {
        it('should return all-null result when fetch is blocked', async () => {
            // Arrange
            const adapter = new BookingReputationAdapter({
                apifyToken: 'tok',
                apifyBookingActor: 'apify/booking-scraper'
            });
            const listing = makeBookingListing();

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: false,
                status: 0,
                error: 'blocked',
                blocked: true
            });

            // Act
            const result = await adapter.fetch(listing);

            // Assert: all-null returned so service can call startRun()
            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
            expect(result.deepLink).toBeNull();
            expect(result.snippets).toBeNull();
            // startApifyRun must NOT be called from fetch() — only from startRun()
            expect(mockStartApifyRun).not.toHaveBeenCalled();
        });

        it('should return all-null when JSON-LD aggregateRating has no rating/count values', async () => {
            // Arrange: JSON-LD present but aggregateRating has only bestRating (no values)
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            const jsonLd = {
                '@type': 'Hotel',
                aggregateRating: { bestRating: 10 }
            };

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
                finalUrl: listing.url
            });

            // Act
            const result = await adapter.fetch(listing);

            // Assert: falls through to empty — no usable rating data
            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
        });

        it('should return all-null when no credentials and JSON-LD blocked', async () => {
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: false,
                status: 0,
                error: 'blocked',
                blocked: true
            });

            const result = await adapter.fetch(listing);

            expect(mockStartApifyRun).not.toHaveBeenCalled();
            expect(result.rating).toBeNull();
            expect(result.snippets).toBeNull();
        });
    });

    describe('startRun() — Phase A async enqueue', () => {
        it('should call startApifyRun with correct actor input and return runId + datasetId', async () => {
            // Arrange
            const adapter = new BookingReputationAdapter({
                apifyToken: 'tok',
                apifyBookingActor: 'apify/booking-scraper'
            });
            const listing = makeBookingListing();

            mockStartApifyRun.mockResolvedValueOnce({
                runId: 'run-abc-123',
                defaultDatasetId: 'ds-xyz-456'
            });

            // Act
            const result = await adapter.startRun(listing);

            // Assert
            expect(mockStartApifyRun).toHaveBeenCalledOnce();
            expect(mockStartApifyRun).toHaveBeenCalledWith({
                token: 'tok',
                actor: 'apify/booking-scraper',
                actorInput: { startUrls: [{ url: listing.url }] }
            });
            expect(result).toEqual({ runId: 'run-abc-123', datasetId: 'ds-xyz-456' });
        });

        it('should return null when apifyToken is absent', async () => {
            // Arrange
            const adapter = new BookingReputationAdapter({
                apifyBookingActor: 'apify/booking-scraper'
            });
            const listing = makeBookingListing();

            // Act
            const result = await adapter.startRun(listing);

            // Assert
            expect(mockStartApifyRun).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });

        it('should return null when apifyBookingActor is absent', async () => {
            // Arrange
            const adapter = new BookingReputationAdapter({ apifyToken: 'tok' });
            const listing = makeBookingListing();

            // Act
            const result = await adapter.startRun(listing);

            // Assert
            expect(mockStartApifyRun).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });

        it('should return null when startApifyRun returns null (Apify error)', async () => {
            // Arrange
            const adapter = new BookingReputationAdapter({
                apifyToken: 'tok',
                apifyBookingActor: 'apify/booking-scraper'
            });
            const listing = makeBookingListing();

            mockStartApifyRun.mockResolvedValueOnce(null);

            // Act
            const result = await adapter.startRun(listing);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null when both credentials are absent', async () => {
            // Arrange
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            // Act
            const result = await adapter.startRun(listing);

            // Assert
            expect(mockStartApifyRun).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });
    });

    describe('mapDatasetItems() — Phase B pure mapping', () => {
        it('should extract rating, reviewsCount and deepLink from a standard Booking dataset item', () => {
            // Arrange
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();
            const items = [
                {
                    rating: 8.1,
                    reviewsCount: 175,
                    url: 'https://www.booking.com/hotel/ar/specific-path.html'
                }
            ];

            // Act
            const result = adapter.mapDatasetItems(items, listing);

            // Assert
            expect(result.rating).toBe(8.1);
            expect(result.reviewsCount).toBe(175);
            expect(result.deepLink).toBe('https://www.booking.com/hotel/ar/specific-path.html');
            expect(result.snippets).toBeNull();
        });

        it('should read reviewsCount from `reviews` field (voyager/booking-scraper shape)', () => {
            // Arrange
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();
            const items = [{ rating: 8.8, reviews: 422, stars: 4 }];

            // Act
            const result = adapter.mapDatasetItems(items, listing);

            // Assert
            expect(result.rating).toBe(8.8);
            expect(result.reviewsCount).toBe(422);
        });

        it('should fall back to reviewScore when rating is absent', () => {
            // Arrange
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();
            const items = [{ reviewScore: 7.5, numberOfReviews: 80 }];

            // Act
            const result = adapter.mapDatasetItems(items, listing);

            // Assert
            expect(result.rating).toBe(7.5);
            expect(result.reviewsCount).toBe(80);
        });

        it('should fall back to guestRating when rating and reviewScore are absent', () => {
            // Arrange
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();
            const items = [{ guestRating: 9.0, reviewsCount: 300 }];

            // Act
            const result = adapter.mapDatasetItems(items, listing);

            // Assert
            expect(result.rating).toBe(9.0);
        });

        it('should fall back to listing.url as deepLink when item has no url', () => {
            // Arrange
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();
            const items = [{ rating: 8.5, reviewsCount: 100 }];

            // Act
            const result = adapter.mapDatasetItems(items, listing);

            // Assert
            expect(result.deepLink).toBe(listing.url);
        });

        it('should return empty result when items array is empty', () => {
            // Arrange
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            // Act
            const result = adapter.mapDatasetItems([], listing);

            // Assert
            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
            expect(result.deepLink).toBeNull();
            expect(result.snippets).toBeNull();
        });

        it('should parse string-typed rating via parseFloat', () => {
            // Arrange
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();
            const items = [{ rating: '8.3', reviewsCount: 120 }];

            // Act
            const result = adapter.mapDatasetItems(items, listing);

            // Assert
            expect(result.rating).toBe(8.3);
        });

        it('should return null rating for non-numeric string', () => {
            // Arrange
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();
            const items = [{ rating: 'n/a', reviewsCount: 50 }];

            // Act
            const result = adapter.mapDatasetItems(items, listing);

            // Assert
            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBe(50);
        });
    });

    describe('error handling', () => {
        it('should return empty result on unexpected exception without throwing', async () => {
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            mockSafeExternalFetch.mockRejectedValueOnce(new Error('unexpected'));

            await expect(adapter.fetch(listing)).resolves.toMatchObject({
                rating: null,
                reviewsCount: null,
                snippets: null
            });
        });
    });

    describe('JSON-LD array-level parsing', () => {
        it('should parse aggregateRating when the JSON-LD block is an array of schema.org nodes', async () => {
            // The Booking.com `findAggregateRating` helper recurses into arrays at
            // the top level — exercise that branch with a JSON-LD block that is
            // itself an array rather than a single object.
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            const jsonLdArray = [
                { '@type': 'WebSite', name: 'Booking.com' },
                {
                    '@type': 'Hotel',
                    name: 'Test Hotel',
                    aggregateRating: {
                        '@type': 'AggregateRating',
                        ratingValue: 7.8,
                        reviewCount: 320
                    }
                }
            ];

            const html = `<!DOCTYPE html><html><body>
                <script type="application/ld+json">${JSON.stringify(jsonLdArray)}</script>
            </body></html>`;

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: html,
                finalUrl: listing.url
            });

            const result = await adapter.fetch(listing);

            expect(result.rating).toBe(7.8);
            expect(result.reviewsCount).toBe(320);
            expect(result.snippets).toBeNull();
        });

        it('should parse aggregateRating from ratingCount when reviewCount is absent', async () => {
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            const jsonLd = {
                '@type': 'Hotel',
                aggregateRating: {
                    ratingValue: 8.0,
                    ratingCount: 150
                    // intentionally no reviewCount
                }
            };

            const html = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: html,
                finalUrl: listing.url
            });

            const result = await adapter.fetch(listing);

            expect(result.rating).toBe(8.0);
            expect(result.reviewsCount).toBe(150);
        });
    });

    describe('@graph loop fallthrough — no aggregateRating found', () => {
        it('should return null when @graph array has items but none have aggregateRating', async () => {
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            const jsonLdWithEmptyGraph = {
                '@type': 'WebSite',
                '@graph': [
                    { '@type': 'BreadcrumbList', itemListElement: [] },
                    { '@type': 'Person', name: 'Author' }
                    // No aggregateRating in any @graph node
                ]
            };

            const html = `<script type="application/ld+json">${JSON.stringify(jsonLdWithEmptyGraph)}</script>`;

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: html,
                finalUrl: listing.url
            });

            const result = await adapter.fetch(listing);

            // No aggregateRating found → all null
            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
        });

        it('should return null when ratingValue and reviewCount are both undefined', async () => {
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            const jsonLd = {
                '@type': 'Hotel',
                aggregateRating: {
                    // Neither ratingValue nor reviewCount present
                    bestRating: 10
                }
            };

            const html = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: html,
                finalUrl: listing.url
            });

            const result = await adapter.fetch(listing);

            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
        });
    });

    describe('extractFromAggregateRating — string-typed ratingValue / reviewCount', () => {
        it('should parse string-typed ratingValue via parseFloat', async () => {
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            const jsonLd = {
                '@type': 'Hotel',
                aggregateRating: {
                    ratingValue: '9.4', // string, not number
                    reviewCount: 512
                }
            };

            const html = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: html,
                finalUrl: listing.url
            });

            const result = await adapter.fetch(listing);

            expect(result.rating).toBe(9.4);
            expect(result.reviewsCount).toBe(512);
        });

        it('should parse string-typed reviewCount via parseInt', async () => {
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            const jsonLd = {
                '@type': 'Hotel',
                aggregateRating: {
                    ratingValue: 8.2,
                    reviewCount: '1024' // string, not number
                }
            };

            const html = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: html,
                finalUrl: listing.url
            });

            const result = await adapter.fetch(listing);

            expect(result.rating).toBe(8.2);
            expect(result.reviewsCount).toBe(1024);
        });
    });
});

/**
 * Unit tests for BookingReputationAdapter (SPEC-237 T-006)
 *
 * Key assertions:
 * - AC-7.1 legal guard: `snippets` is ALWAYS `null` even when the source
 *   payload contains review text / snippet data.
 * - JSON-LD primary path: parses `aggregateRating` from embedded LD+JSON.
 * - Apify fallback: used when primary fetch is blocked or yields no data.
 * - Credential degradation: no Apify token/actor → degrade without fetching.
 * - Never throws.
 */

import { ExternalPlatformEnum, LifecycleStatusEnum } from '@repo/schemas';
import type { AccommodationExternalListing } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingReputationAdapter } from '../../src/services/accommodation-external-reputation/adapters/booking-reputation.adapter.js';

// ---------------------------------------------------------------------------
// Mock safeExternalFetch and runApifyActor
// ---------------------------------------------------------------------------

const { mockSafeExternalFetch, mockRunApifyActor } = vi.hoisted(() => ({
    mockSafeExternalFetch: vi.fn(),
    mockRunApifyActor: vi.fn()
}));

vi.mock('@repo/utils', () => ({
    safeExternalFetch: mockSafeExternalFetch
}));

vi.mock('../../src/services/accommodation-import/adapters/apify-client.js', () => ({
    runApifyActor: mockRunApifyActor
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

        it('should return snippets:null when Apify actor returns review data', async () => {
            // Arrange: Apify dataset includes reviewText / reviewsList — must be stripped
            const adapter = new BookingReputationAdapter({
                apifyToken: 'tok',
                apifyBookingActor: 'apify/booking-scraper'
            });
            const listing = makeBookingListing();

            // Primary fetch blocked
            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: false,
                status: 0,
                error: 'blocked',
                blocked: true
            });

            // Apify returns data WITH review text (should be stripped by adapter)
            mockRunApifyActor.mockResolvedValueOnce([
                {
                    rating: 8.8,
                    reviewsCount: 300,
                    url: 'https://www.booking.com/hotel/ar/test.html',
                    // These fields MUST NOT appear in the result:
                    reviewText: 'Absolutely wonderful stay!',
                    reviewsList: [{ author: 'Guest B', text: 'Great location!', rating: 9 }]
                }
            ]);

            // Act
            const result = await adapter.fetch(listing);

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

        it('should NOT call Apify when JSON-LD provides sufficient data', async () => {
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

            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });
    });

    describe('fallback path — Apify actor', () => {
        it('should use Apify when primary fetch is blocked', async () => {
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

            mockRunApifyActor.mockResolvedValueOnce([{ rating: 8.1, reviewsCount: 175 }]);

            const result = await adapter.fetch(listing);

            expect(mockRunApifyActor).toHaveBeenCalledOnce();
            expect(result.rating).toBe(8.1);
            expect(result.reviewsCount).toBe(175);
            expect(result.snippets).toBeNull();
        });

        it('should return empty result when Apify returns empty dataset', async () => {
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
            mockRunApifyActor.mockResolvedValueOnce([]);

            const result = await adapter.fetch(listing);

            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
        });
    });

    describe('credential degradation', () => {
        it('should return empty result when no Apify credentials and primary fetch blocked', async () => {
            const adapter = new BookingReputationAdapter({});
            const listing = makeBookingListing();

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: false,
                status: 0,
                error: 'blocked',
                blocked: true
            });

            const result = await adapter.fetch(listing);

            expect(mockRunApifyActor).not.toHaveBeenCalled();
            expect(result.rating).toBeNull();
            expect(result.snippets).toBeNull();
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
});

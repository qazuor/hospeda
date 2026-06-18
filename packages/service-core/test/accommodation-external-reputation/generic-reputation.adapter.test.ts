/**
 * Unit tests for GenericReputationAdapter (SPEC-237 T-006)
 *
 * Key assertions:
 * - AC-7.1 legal guard: `snippets` is ALWAYS `null`.
 * - JSON-LD `aggregateRating` is parsed correctly from the page body.
 * - `safeExternalFetch` block / failure → all-null result.
 * - No `aggregateRating` in page → all-null result.
 * - `parseAggregateRatingFromPage` helper is testable in isolation.
 * - Never throws.
 */

import { ExternalPlatformEnum, LifecycleStatusEnum } from '@repo/schemas';
import type { AccommodationExternalListing } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    GenericReputationAdapter,
    parseAggregateRatingFromPage
} from '../../src/services/accommodation-external-reputation/adapters/generic-reputation.adapter.js';

// ---------------------------------------------------------------------------
// Mock safeExternalFetch
// ---------------------------------------------------------------------------

const { mockSafeExternalFetch } = vi.hoisted(() => ({
    mockSafeExternalFetch: vi.fn()
}));

vi.mock('@repo/utils', () => ({
    safeExternalFetch: mockSafeExternalFetch
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGenericListing(
    overrides: Partial<AccommodationExternalListing> = {}
): AccommodationExternalListing {
    return {
        id: '00000000-0000-0000-0000-000000000001',
        accommodationId: '00000000-0000-0000-0000-000000000002',
        platform: ExternalPlatformEnum.OTHER,
        url: 'https://www.someplatform.com/hotels/test-hotel',
        externalId: null,
        showLink: false,
        showReviews: false,
        verified: true,
        createdById: '00000000-0000-0000-0000-000000000003',
        updatedById: '00000000-0000-0000-0000-000000000003',
        deletedById: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        deletedAt: null,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        ...overrides
    };
}

/**
 * Builds an HTML page embedding a JSON-LD aggregateRating block.
 */
function makeHtmlWithAggregateRating(options: {
    ratingValue?: number | string;
    reviewCount?: number | string;
    ratingCount?: number | string;
    schemaType?: string;
    nested?: boolean;
}): string {
    const { ratingValue = 4.3, reviewCount = 150, schemaType = 'Hotel', nested = false } = options;

    const aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue,
        reviewCount: options.ratingCount ?? reviewCount
    };

    const root = nested
        ? {
              '@context': 'https://schema.org',
              '@graph': [
                  {
                      '@type': schemaType,
                      name: 'Generic Hotel',
                      aggregateRating
                  }
              ]
          }
        : {
              '@context': 'https://schema.org',
              '@type': schemaType,
              name: 'Generic Hotel',
              aggregateRating
          };

    return `<!DOCTYPE html><html><body>
        <script type="application/ld+json">${JSON.stringify(root)}</script>
        <h1>Generic Hotel</h1>
    </body></html>`;
}

// ---------------------------------------------------------------------------
// Unit tests for parseAggregateRatingFromPage helper
// ---------------------------------------------------------------------------

describe('parseAggregateRatingFromPage', () => {
    it('should parse aggregateRating from a top-level schema.org node', () => {
        const html = makeHtmlWithAggregateRating({ ratingValue: 4.5, reviewCount: 100 });
        const result = parseAggregateRatingFromPage(html);

        expect(result).not.toBeNull();
        expect(result!.ratingValue).toBe(4.5);
        expect(result!.reviewCount).toBe(100);
    });

    it('should parse aggregateRating from a @graph-wrapped structure', () => {
        const html = makeHtmlWithAggregateRating({
            ratingValue: 3.9,
            reviewCount: 80,
            nested: true
        });
        const result = parseAggregateRatingFromPage(html);

        expect(result).not.toBeNull();
        expect(result!.ratingValue).toBe(3.9);
    });

    it('should parse aggregateRating from string-typed ratingValue', () => {
        const html = makeHtmlWithAggregateRating({ ratingValue: '4.8', reviewCount: '220' });
        const result = parseAggregateRatingFromPage(html);

        expect(result).not.toBeNull();
        expect(result!.ratingValue).toBe('4.8');
    });

    it('should return null when no JSON-LD blocks are present', () => {
        const html = '<html><body><h1>No structured data</h1></body></html>';
        const result = parseAggregateRatingFromPage(html);

        expect(result).toBeNull();
    });

    it('should return null when JSON-LD block has no aggregateRating', () => {
        const html = `<html><body>
            <script type="application/ld+json">
                {"@type":"Hotel","name":"Plain Hotel"}
            </script>
        </body></html>`;
        const result = parseAggregateRatingFromPage(html);

        expect(result).toBeNull();
    });

    it('should handle malformed JSON-LD without throwing', () => {
        const html = `<html><body>
            <script type="application/ld+json">
                { invalid json...
            </script>
        </body></html>`;

        expect(() => parseAggregateRatingFromPage(html)).not.toThrow();
        expect(parseAggregateRatingFromPage(html)).toBeNull();
    });

    it('should parse from multiple LD+JSON blocks, returning the first aggregateRating found', () => {
        const html = `<html><body>
            <script type="application/ld+json">
                {"@type":"BreadcrumbList","itemListElement":[]}
            </script>
            <script type="application/ld+json">
                {"@type":"Hotel","aggregateRating":{"ratingValue":4.1,"reviewCount":55}}
            </script>
        </body></html>`;

        const result = parseAggregateRatingFromPage(html);

        expect(result).not.toBeNull();
        expect(result!.ratingValue).toBe(4.1);
    });
});

// ---------------------------------------------------------------------------
// GenericReputationAdapter integration tests
// ---------------------------------------------------------------------------

describe('GenericReputationAdapter', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('AC-7.1 legal guard — snippets must ALWAYS be null', () => {
        it('should return snippets:null regardless of page content', async () => {
            const adapter = new GenericReputationAdapter();
            const listing = makeGenericListing();

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: makeHtmlWithAggregateRating({ ratingValue: 4.5, reviewCount: 100 }),
                finalUrl: listing.url
            });

            const result = await adapter.fetch(listing);

            // AC-7.1: unknown platform ToS → never surface review text
            expect(result.snippets).toBeNull();
        });
    });

    describe('successful JSON-LD parse', () => {
        it('should return rating and reviewsCount from aggregateRating', async () => {
            const adapter = new GenericReputationAdapter();
            const listing = makeGenericListing();

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: makeHtmlWithAggregateRating({ ratingValue: 4.3, reviewCount: 150 }),
                finalUrl: listing.url
            });

            const result = await adapter.fetch(listing);

            expect(result.rating).toBe(4.3);
            expect(result.reviewsCount).toBe(150);
            expect(result.deepLink).toBe(listing.url);
            expect(result.snippets).toBeNull();
            expect(result.attributionUrl).toBeNull();
        });

        it('should handle string-typed ratingValue by converting to float', async () => {
            const adapter = new GenericReputationAdapter();
            const listing = makeGenericListing();

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: makeHtmlWithAggregateRating({ ratingValue: '8.7', reviewCount: '320' }),
                finalUrl: listing.url
            });

            const result = await adapter.fetch(listing);

            expect(result.rating).toBe(8.7);
            expect(result.reviewsCount).toBe(320);
        });

        it('should parse from @graph-nested aggregateRating', async () => {
            const adapter = new GenericReputationAdapter();
            const listing = makeGenericListing();

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: makeHtmlWithAggregateRating({
                    ratingValue: 3.9,
                    reviewCount: 80,
                    nested: true
                }),
                finalUrl: listing.url
            });

            const result = await adapter.fetch(listing);

            expect(result.rating).toBe(3.9);
            expect(result.reviewsCount).toBe(80);
        });
    });

    describe('degradation cases', () => {
        it('should return all-null result when fetch is blocked', async () => {
            const adapter = new GenericReputationAdapter();
            const listing = makeGenericListing();

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: false,
                status: 0,
                error: 'Blocked by SSRF policy',
                blocked: true
            });

            const result = await adapter.fetch(listing);

            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
            expect(result.deepLink).toBeNull();
            expect(result.snippets).toBeNull();
        });

        it('should return all-null result when page has no aggregateRating', async () => {
            const adapter = new GenericReputationAdapter();
            const listing = makeGenericListing();

            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: '<html><body><h1>Hotel with no structured data</h1></body></html>',
                finalUrl: listing.url
            });

            const result = await adapter.fetch(listing);

            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
        });

        it('should return all-null result when both parsed values are null', async () => {
            // aggregateRating node exists but has no parseable numbers
            const html = `<html><body>
                <script type="application/ld+json">
                    {"@type":"Hotel","aggregateRating":{"ratingValue":"N/A","reviewCount":"unknown"}}
                </script>
            </body></html>`;

            const adapter = new GenericReputationAdapter();
            const listing = makeGenericListing();

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

        it('should return all-null result without throwing on unexpected error', async () => {
            const adapter = new GenericReputationAdapter();
            const listing = makeGenericListing();

            mockSafeExternalFetch.mockRejectedValueOnce(new Error('unexpected'));

            await expect(adapter.fetch(listing)).resolves.toMatchObject({
                rating: null,
                reviewsCount: null,
                snippets: null
            });
        });
    });
});

/**
 * Unit tests for GoogleReputationAdapter (SPEC-237 T-006)
 *
 * Verifies:
 * - Rating + reviewsCount are mapped from the Places API response.
 * - Up to 5 review snippets are mapped with all optional fields.
 * - Reviews with missing required fields (author/text) are discarded.
 * - `deepLink` uses `googleMapsUri` from the response; falls back to listing URL.
 * - `attributionUrl` is always set for Google results.
 * - Credential degradation: empty API key → all-null result.
 * - Place ID resolution from URL when `externalId` is absent.
 * - Non-2xx / network errors → all-null result (never throws).
 * - Snippets carry the data the service will timestamp (TTL anchor concept).
 */

import { ExternalPlatformEnum, LifecycleStatusEnum } from '@repo/schemas';
import type { AccommodationExternalListing } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleReputationAdapter } from '../../src/services/accommodation-external-reputation/adapters/google-reputation.adapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal AccommodationExternalListing fixture for tests.
 */
function makeGoogleListing(
    overrides: Partial<AccommodationExternalListing> = {}
): AccommodationExternalListing {
    return {
        id: '11111111-1111-1111-1111-111111111111',
        accommodationId: '22222222-2222-2222-2222-222222222222',
        platform: ExternalPlatformEnum.GOOGLE,
        url: 'https://www.google.com/maps/place/Test+Hotel/@-32.4825,-58.2375,15z/data=!3m1!4b1!4m9!3m8!1s!5m2!4m1!1i2!8m2!3d-32.48!4d-58.23!16s%2Fg%2F11ChIJN1t_tDeuEmsRUsoyG83frY4',
        externalId: null,
        showLink: false,
        showReviews: false,
        verified: true,
        createdById: '33333333-3333-3333-3333-333333333333',
        updatedById: '33333333-3333-3333-3333-333333333333',
        deletedById: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        deletedAt: null,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        ...overrides
    };
}

/**
 * Builds a minimal Places API (New) response body.
 */
function makePlacesResponse(overrides: Record<string, unknown> = {}): unknown {
    return {
        rating: 4.7,
        userRatingsTotal: 312,
        googleMapsUri: 'https://maps.google.com/?cid=12345',
        displayName: { text: 'Test Hotel' },
        reviews: [
            {
                rating: 5,
                text: { text: 'Excellent stay!' },
                authorAttribution: {
                    displayName: 'Alice B.',
                    uri: 'https://www.google.com/maps/contrib/12345',
                    photoUri: 'https://lh3.googleusercontent.com/a/photo.jpg'
                },
                publishTime: '2024-03-15T10:00:00Z',
                relativePublishTimeDescription: 'a month ago'
            },
            {
                rating: 4,
                text: { text: 'Very good location.' },
                authorAttribution: {
                    displayName: 'Bob C.',
                    uri: 'https://www.google.com/maps/contrib/67890',
                    photoUri: null
                },
                publishTime: '2024-02-20T08:00:00Z',
                relativePublishTimeDescription: '2 months ago'
            }
        ],
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn<typeof globalThis.fetch>();

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GoogleReputationAdapter', () => {
    describe('when credentials are missing', () => {
        it('should return all-null result immediately without fetching', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: '' });
            const listing = makeGoogleListing();

            const result = await adapter.fetch(listing);

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
            expect(result.deepLink).toBeNull();
            expect(result.snippets).toBeNull();
        });
    });

    describe('when Place ID is not resolvable', () => {
        it('should return all-null result when listing has no externalId and URL has no ChIJ token', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({
                externalId: null,
                url: 'https://www.google.com/maps/place/SomePlace'
            });

            const result = await adapter.fetch(listing);

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.rating).toBeNull();
            expect(result.snippets).toBeNull();
        });

        it('should resolve Place ID from listing.externalId when provided', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({
                externalId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
                url: 'https://www.google.com/maps/place/SomePlace'
            });

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(makePlacesResponse()), { status: 200 })
            );

            const result = await adapter.fetch(listing);

            expect(mockFetch).toHaveBeenCalledOnce();
            expect(result.rating).toBe(4.7);
        });
    });

    describe('when the Places API returns a valid response', () => {
        it('should map rating and reviewsCount correctly', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({
                externalId: 'ChIJN1t_tDeuEmsRUsoyG83frY4'
            });

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(makePlacesResponse()), { status: 200 })
            );

            const result = await adapter.fetch(listing);

            expect(result.rating).toBe(4.7);
            expect(result.reviewsCount).toBe(312);
        });

        it('should set deepLink to googleMapsUri from the response', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({ externalId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(makePlacesResponse()), { status: 200 })
            );

            const result = await adapter.fetch(listing);

            expect(result.deepLink).toBe('https://maps.google.com/?cid=12345');
        });

        it('should fall back to listing.url for deepLink when googleMapsUri is absent', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({ externalId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });

            const response = makePlacesResponse({ googleMapsUri: undefined });
            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(response), { status: 200 })
            );

            const result = await adapter.fetch(listing);

            expect(result.deepLink).toBe(listing.url);
        });

        it('should always set attributionUrl for Google results', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({ externalId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(makePlacesResponse()), { status: 200 })
            );

            const result = await adapter.fetch(listing);

            expect(result.attributionUrl).toBeTruthy();
            expect(typeof result.attributionUrl).toBe('string');
        });

        it('should map up to 5 review snippets with all optional fields', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({ externalId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(makePlacesResponse()), { status: 200 })
            );

            const result = await adapter.fetch(listing);

            expect(result.snippets).not.toBeNull();
            expect(Array.isArray(result.snippets)).toBe(true);
            expect(result.snippets!.length).toBe(2);

            const first = result.snippets![0];
            expect(first).toBeDefined();
            expect(first!.author).toBe('Alice B.');
            expect(first!.text).toBe('Excellent stay!');
            expect(first!.rating).toBe(5);
            expect(first!.timeIso).toBe('2024-03-15T10:00:00Z');
            expect(first!.authorUrl).toBe('https://www.google.com/maps/contrib/12345');
            expect(first!.profilePhoto).toBe('https://lh3.googleusercontent.com/a/photo.jpg');
            expect(first!.relativeTime).toBe('a month ago');
        });

        it('should cap snippets at 5 even when API returns more', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({ externalId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });

            const reviews = Array.from({ length: 8 }, (_, i) => ({
                rating: 4,
                text: { text: `Review number ${i + 1}` },
                authorAttribution: {
                    displayName: `User ${i + 1}`,
                    uri: null,
                    photoUri: null
                },
                publishTime: '2024-01-01T00:00:00Z',
                relativePublishTimeDescription: 'recently'
            }));

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(makePlacesResponse({ reviews })), { status: 200 })
            );

            const result = await adapter.fetch(listing);

            expect(result.snippets).not.toBeNull();
            expect(result.snippets!.length).toBeLessThanOrEqual(5);
        });

        it('should discard reviews missing author or text', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({ externalId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });

            const reviews = [
                // Valid
                {
                    rating: 5,
                    text: { text: 'Great place!' },
                    authorAttribution: { displayName: 'Alice', uri: null, photoUri: null }
                },
                // Missing text
                {
                    rating: 3,
                    text: undefined,
                    authorAttribution: { displayName: 'Bob', uri: null, photoUri: null }
                },
                // Missing author
                {
                    rating: 4,
                    text: { text: 'Nice.' },
                    authorAttribution: undefined
                }
            ];

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(makePlacesResponse({ reviews })), { status: 200 })
            );

            const result = await adapter.fetch(listing);

            // Only the first review is valid
            expect(result.snippets).not.toBeNull();
            expect(result.snippets!.length).toBe(1);
            expect(result.snippets![0]!.author).toBe('Alice');
        });

        it('should return snippets:null when reviews array is empty', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({ externalId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(makePlacesResponse({ reviews: [] })), { status: 200 })
            );

            const result = await adapter.fetch(listing);

            expect(result.snippets).toBeNull();
        });

        it('TTL anchor: snippets carry review data the service will timestamp', async () => {
            // Verifies that the adapter returns snippets with meaningful data
            // that the service layer can store with a `snippetsFetchedAt` timestamp.
            // The adapter itself does NOT timestamp — it just returns the data.
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({ externalId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(makePlacesResponse()), { status: 200 })
            );

            const result = await adapter.fetch(listing);

            // The service will use result.snippets to set snippetsFetchedAt = now()
            // when persisting. We verify snippets are non-null and carry text.
            expect(result.snippets).not.toBeNull();
            expect(result.snippets!.every((s) => typeof s.author === 'string')).toBe(true);
            expect(result.snippets!.every((s) => typeof s.text === 'string')).toBe(true);
        });
    });

    describe('when the Places API returns an error', () => {
        it('should return all-null result on non-2xx response', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({ externalId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify({ error: { message: 'NOT_FOUND', code: 404 } }), {
                    status: 404
                })
            );

            const result = await adapter.fetch(listing);

            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
            expect(result.snippets).toBeNull();
        });

        it('should return all-null result on API error payload (2xx body with error field)', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({ externalId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify({ error: { message: 'REQUEST_DENIED', code: 403 } }), {
                    status: 200
                })
            );

            const result = await adapter.fetch(listing);

            expect(result.rating).toBeNull();
            expect(result.snippets).toBeNull();
        });

        it('should return all-null result on network error without throwing', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({ externalId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });

            mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

            await expect(adapter.fetch(listing)).resolves.toMatchObject({
                rating: null,
                reviewsCount: null,
                snippets: null
            });
        });
    });

    describe('Place ID extraction from URL', () => {
        it('should extract Place ID via ChIJ token in the listing URL path', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            // URL contains ChIJ token embedded in the data segment
            const listing = makeGoogleListing({
                externalId: null,
                url: 'https://www.google.com/maps/place/Test/@-32.48,-58.23,15z/data=!3m1!4b1!4m9!3m8!1sChIJN1t_tDeuEmsRUsoyG83frY4'
            });

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(makePlacesResponse()), { status: 200 })
            );

            const result = await adapter.fetch(listing);

            expect(mockFetch).toHaveBeenCalledOnce();
            expect(result.rating).toBe(4.7);
        });

        it('should extract Place ID from place_id query param', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({
                externalId: null,
                url: 'https://www.google.com/maps?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            });

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(makePlacesResponse()), { status: 200 })
            );

            const result = await adapter.fetch(listing);

            expect(result.rating).toBe(4.7);
        });
    });

    describe('Place ID URL encoding (L3 regression)', () => {
        it('should percent-encode metacharacters in externalId so they cannot inject path/query segments', async () => {
            // Arrange — externalId contains URL metacharacters an owner might supply
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const maliciousId = 'ChIJ?x=1&evil=true';
            const listing = makeGoogleListing({
                externalId: maliciousId,
                url: 'https://www.google.com/maps'
            });

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(makePlacesResponse()), { status: 200 })
            );

            await adapter.fetch(listing);

            // Assert — the outbound URL must have no raw '?' or '&' injected
            const calledUrl = (mockFetch.mock.calls[0] as [string])[0];
            // The injected query characters must be percent-encoded in the path
            expect(calledUrl).not.toContain('?x=1');
            expect(calledUrl).not.toContain('&evil=true');
            // But the encoded form must appear in the URL
            expect(calledUrl).toContain(encodeURIComponent(maliciousId));
        });

        it('should percent-encode path traversal in externalId', async () => {
            // Arrange — externalId contains path traversal characters
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const traversalId = 'ChIJ/../foo';
            const listing = makeGoogleListing({
                externalId: traversalId,
                url: 'https://www.google.com/maps'
            });

            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify(makePlacesResponse()), { status: 200 })
            );

            await adapter.fetch(listing);

            const calledUrl = (mockFetch.mock.calls[0] as [string])[0];
            // '/' must be percent-encoded so path is not traversed
            expect(calledUrl).not.toMatch(/ChIJ\/\.\./);
            expect(calledUrl).toContain(encodeURIComponent(traversalId));
        });

        it('should return empty result for whitespace-only externalId without fetching', async () => {
            // Arrange
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });
            const listing = makeGoogleListing({
                externalId: '   ',
                url: 'https://www.google.com/maps' // no ChIJ token
            });

            // Act
            const result = await adapter.fetch(listing);

            // Assert — whitespace-only ID should fall through to resolveGooglePlaceId
            // which returns null for this URL → emptyReputationResult returned, no fetch
            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.rating).toBeNull();
        });
    });
});

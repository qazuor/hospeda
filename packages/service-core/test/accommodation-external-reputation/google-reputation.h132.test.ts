/**
 * Regression suite for H-132 — "the Google review fetch never calls the API and
 * reports it as a success".
 *
 * ## Why this file exists separately
 *
 * The pre-existing adapter suite is not weak; it is precise about the wrong
 * contract. It asserted `expect(mockFetch).not.toHaveBeenCalled()` for a URL
 * with no `ChIJ` token — encoding "we don't call Google for this URL" as
 * *correct*. Every URL a host can actually copy out of Google is such a URL, so
 * the suite was green while the integration did nothing at all, in production,
 * for months.
 *
 * Every test here therefore asserts on **the outbound request**, not on the
 * shape of the returned object. A test that only inspects the result cannot
 * tell "Google returned zero reviews" from "we never asked Google" — those two
 * produce byte-identical results, and that indistinguishability IS the bug.
 *
 * ## The URLs are real
 *
 * `ADDRESS_BAR_URL` and `SHARE_URL` are the two shapes found in the production
 * `accommodation_external_listings` table (verified 2026-08-15; both rows had
 * `fetch_status = 'ok'` with all four data columns NULL). Neither contains a
 * `ChIJ` token. Synthetic `ChIJ`-bearing fixtures are what let the gap survive
 * review, so they are deliberately not used as the primary cases here.
 */

import type { AccommodationExternalListing } from '@repo/schemas';
import { ExternalPlatformEnum, LifecycleStatusEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleReputationAdapter } from '../../src/services/accommodation-external-reputation/adapters/google-reputation.adapter.js';

// ---------------------------------------------------------------------------
// Short-link module: identity by default, overridden per-test
// ---------------------------------------------------------------------------

const canonicalizeIfShortLink = vi.fn(
    async (input: { rawUrl: string; timeoutMs: number }): Promise<string> => input.rawUrl
);

vi.mock('../../src/utils/short-link.js', () => ({
    canonicalizeIfShortLink: (input: { rawUrl: string; timeoutMs: number }) =>
        canonicalizeIfShortLink(input)
}));

// ---------------------------------------------------------------------------
// Fixtures — the two URL shapes that exist in production
// ---------------------------------------------------------------------------

/** What a host copies out of the browser address bar. Carries an ftid, no ChIJ. */
const ADDRESS_BAR_URL =
    'https://www.google.com/maps/place/Cheroga+Casa+Quinta/@-32.4878177,-58.3600344,17z';

/** What the Google Maps "Share" button produces. Carries no identifier at all. */
const SHARE_URL = 'https://share.google/IUko8vyFORxaIjDM1';

const RESOLVED_PLACE_ID = 'ChIJN1t_tDeuEmsRUsoyG83frY4';

function makeGoogleListing(
    overrides: Partial<AccommodationExternalListing> = {}
): AccommodationExternalListing {
    return {
        id: '11111111-1111-1111-1111-111111111111',
        accommodationId: '22222222-2222-2222-2222-222222222222',
        platform: ExternalPlatformEnum.GOOGLE,
        url: ADDRESS_BAR_URL,
        externalId: null,
        showLink: false,
        showReviews: true,
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

/** A Text Search response carrying exactly the ID-only field mask's payload. */
function textSearchHit(placeId = RESOLVED_PLACE_ID): Response {
    return new Response(JSON.stringify({ places: [{ id: placeId }] }), { status: 200 });
}

/** A Place Details response with real review data. */
function placeDetailsHit(overrides: Record<string, unknown> = {}): Response {
    return new Response(
        JSON.stringify({
            rating: 4.8,
            userRatingCount: 41,
            googleMapsUri: 'https://maps.google.com/?cid=987',
            displayName: { text: 'Cheroga Casa Quinta' },
            reviews: [
                {
                    rating: 5,
                    text: { text: 'Hermoso lugar, volveríamos.' },
                    authorAttribution: { displayName: 'Ana P.' },
                    publishTime: '2026-05-02T10:00:00Z'
                }
            ],
            ...overrides
        }),
        { status: 200 }
    );
}

const mockFetch = vi.fn<typeof globalThis.fetch>();

/** Every outbound request as `[url, init]`, in call order. */
function requests(): { url: string; method: string; fieldMask: string; body: string }[] {
    return mockFetch.mock.calls.map((call) => {
        const [url, init] = call as [string, RequestInit | undefined];
        const headers = (init?.headers ?? {}) as Record<string, string>;
        return {
            url: String(url),
            method: init?.method ?? 'GET',
            fieldMask: headers['X-Goog-FieldMask'] ?? '',
            body: typeof init?.body === 'string' ? init.body : ''
        };
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    canonicalizeIfShortLink.mockImplementation(async (input) => input.rawUrl);
    vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GoogleReputationAdapter — H-132 regression', () => {
    describe('the real address-bar URL actually reaches the Places API', () => {
        it('issues a Text Search request naming the place from the URL path', async () => {
            mockFetch.mockResolvedValueOnce(textSearchHit());
            mockFetch.mockResolvedValueOnce(placeDetailsHit());
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });

            await adapter.fetch(makeGoogleListing());

            // THE assertion this bug needed: a request left the process.
            const [textSearch] = requests();
            expect(textSearch).toBeDefined();
            expect(textSearch?.url).toBe('https://places.googleapis.com/v1/places:searchText');
            expect(textSearch?.method).toBe('POST');
            // The place name comes from the `/maps/place/<name>` segment, with
            // `+` decoded back to spaces.
            expect(JSON.parse(textSearch?.body ?? '{}')).toMatchObject({
                textQuery: 'Cheroga Casa Quinta'
            });
        });

        it('biases the Text Search to the @lat,lng viewport in the URL', async () => {
            mockFetch.mockResolvedValueOnce(textSearchHit());
            mockFetch.mockResolvedValueOnce(placeDetailsHit());
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });

            await adapter.fetch(makeGoogleListing());

            const body = JSON.parse(requests()[0]?.body ?? '{}');
            expect(body.locationBias?.circle?.center).toEqual({
                latitude: -32.4878177,
                longitude: -58.3600344
            });
        });

        it('requests only `places.id` from Text Search, keeping it on the cheapest SKU', async () => {
            mockFetch.mockResolvedValueOnce(textSearchHit());
            mockFetch.mockResolvedValueOnce(placeDetailsHit());
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });

            await adapter.fetch(makeGoogleListing());

            expect(requests()[0]?.fieldMask).toBe('places.id');
        });

        it('then fetches Place Details for the resolved id and returns real review data', async () => {
            mockFetch.mockResolvedValueOnce(textSearchHit());
            mockFetch.mockResolvedValueOnce(placeDetailsHit());
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });

            const result = await adapter.fetch(makeGoogleListing());

            const [, details] = requests();
            expect(details?.url).toBe(
                `https://places.googleapis.com/v1/places/${RESOLVED_PLACE_ID}`
            );
            expect(details?.fieldMask).toContain('userRatingCount');
            expect(details?.fieldMask).toContain('reviews');

            expect(result.rating).toBe(4.8);
            expect(result.reviewsCount).toBe(41);
            expect(result.snippets).toHaveLength(1);
            expect(result.failureCode).toBeNull();
        });
    });

    describe('the Share-button URL is followed to its canonical form first', () => {
        it('hands the share link to the short-link resolver and proceeds with the result', async () => {
            canonicalizeIfShortLink.mockResolvedValueOnce(ADDRESS_BAR_URL);
            mockFetch.mockResolvedValueOnce(textSearchHit());
            mockFetch.mockResolvedValueOnce(placeDetailsHit());
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });

            const result = await adapter.fetch(makeGoogleListing({ url: SHARE_URL }));

            expect(canonicalizeIfShortLink).toHaveBeenCalledWith(
                expect.objectContaining({ rawUrl: SHARE_URL })
            );
            expect(requests()).toHaveLength(2);
            expect(result.rating).toBe(4.8);
        });

        it('reports `unresolvable_url` when the redirect could not be followed', async () => {
            // The shared resolver degrades by returning its input unchanged.
            canonicalizeIfShortLink.mockResolvedValueOnce(SHARE_URL);
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });

            const result = await adapter.fetch(makeGoogleListing({ url: SHARE_URL }));

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.failureCode).toBe('unresolvable_url');
        });
    });

    describe('a run that produced no data always says why', () => {
        it('distinguishes "Google has no reviews here" from "we never asked"', async () => {
            // Place exists, Google simply holds no rating for it.
            mockFetch.mockResolvedValueOnce(textSearchHit());
            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify({ displayName: { text: 'Cheroga' } }), { status: 200 })
            );
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });

            const result = await adapter.fetch(makeGoogleListing());

            // Same all-null aggregates as a failed run...
            expect(result.rating).toBeNull();
            expect(result.reviewsCount).toBeNull();
            expect(result.snippets).toBeNull();
            // ...but this one reached Google, and says so. This single field is
            // what the service reads to decide `fetch_status`.
            expect(result.failureCode).toBeNull();
            expect(requests()).toHaveLength(2);
        });

        it('reports `not_found` when Text Search returns zero places', async () => {
            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify({ places: [] }), { status: 200 })
            );
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });

            const result = await adapter.fetch(makeGoogleListing());

            expect(result.failureCode).toBe('not_found');
            // Place Details must NOT be attempted without an id.
            expect(requests()).toHaveLength(1);
        });

        it('reports `credentials_missing` on a 403 from Text Search', async () => {
            mockFetch.mockResolvedValueOnce(new Response('{}', { status: 403 }));
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });

            const result = await adapter.fetch(makeGoogleListing());

            expect(result.failureCode).toBe('credentials_missing');
        });

        it('reports `provider_error` on a 500 from Place Details', async () => {
            mockFetch.mockResolvedValueOnce(textSearchHit());
            mockFetch.mockResolvedValueOnce(new Response('{}', { status: 500 }));
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });

            const result = await adapter.fetch(makeGoogleListing());

            expect(result.failureCode).toBe('provider_error');
        });

        it('reports `credentials_missing` and issues no request when the key is empty', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: '' });

            const result = await adapter.fetch(makeGoogleListing());

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.failureCode).toBe('credentials_missing');
        });

        it('reports `unresolvable_url` and issues no request when the URL names no place', async () => {
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });

            const result = await adapter.fetch(
                makeGoogleListing({ url: 'https://www.google.com/maps' })
            );

            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.failureCode).toBe('unresolvable_url');
        });
    });

    describe('an explicit externalId still short-circuits the ladder', () => {
        it('skips Text Search entirely and goes straight to Place Details', async () => {
            mockFetch.mockResolvedValueOnce(placeDetailsHit());
            const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza-test' });

            const result = await adapter.fetch(
                makeGoogleListing({ externalId: RESOLVED_PLACE_ID })
            );

            expect(requests()).toHaveLength(1);
            expect(requests()[0]?.method).toBe('GET');
            expect(canonicalizeIfShortLink).not.toHaveBeenCalled();
            expect(result.rating).toBe(4.8);
        });
    });
});

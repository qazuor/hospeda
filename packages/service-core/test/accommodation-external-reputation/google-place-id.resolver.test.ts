/**
 * Unit tests for the Google Place ID resolver ladder.
 *
 * Focus: the `/search?q=…` rung. The measured production `share.google` chain
 * ends on a Google search results page
 * (`https://www.google.com/search?…&q=Cheroga+Casa+Quinta&…`), which has no
 * `/maps/place/<name>` segment. Before this rung existed the resolver returned
 * `unresolvable_url` for it and never called Text Search — every test here
 * asserts on the outbound request body, not just the result shape, because a
 * result-only assertion cannot tell "Google found nothing" from "we never
 * asked".
 *
 * The short-link module is mocked so no redirect fetch happens; every case here
 * starts from an already-canonical URL unless stated otherwise.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { resolvePlaceIdFromUrl } from '../../src/services/accommodation-external-reputation/adapters/google-place-id.resolver.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Exactly what the production `share.google` chain redirects to. */
const SEARCH_URL =
    'https://www.google.com/search?sca_esv=abc&kgmid=/g/11ngpqdd9h&q=Cheroga+Casa+Quinta&hl=es';

/** The canonical maps URL produced by `maps.app.goo.gl` in production. */
const MAPS_URL =
    'https://www.google.com/maps/place/Cheroga+Casa+Quinta/@-32.4878177,-58.3626093,17z/data=!3m1!4b1!4m6!3m5!1s0x95b0d9d7fffff:0x1234';

const SHARE_URL = 'https://share.google/IUko8vyFORxaIjDM1';

const RESOLVED_PLACE_ID = 'ChIJN1t_tDeuEmsRUsoyG83frY4';

function textSearchHit(placeId = RESOLVED_PLACE_ID): Response {
    return new Response(JSON.stringify({ places: [{ id: placeId }] }), { status: 200 });
}

const mockFetch = vi.fn<typeof globalThis.fetch>();

/** The single outbound Text Search request as `{ url, method, body }`. */
function lastTextSearchRequest(): { url: string; method: string; body: Record<string, unknown> } {
    const call = mockFetch.mock.calls[0];
    if (!call) {
        throw new Error('fetch was not called');
    }
    const [url, init] = call as [string, RequestInit | undefined];
    return {
        url: String(url),
        method: init?.method ?? 'GET',
        body: JSON.parse(typeof init?.body === 'string' ? init.body : '{}')
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    canonicalizeIfShortLink.mockImplementation(async (input) => input.rawUrl);
    vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('resolvePlaceIdFromUrl', () => {
    describe('rung 4 — Google `/search?q=…` canonical URL', () => {
        it('resolves via Text Search using the `q` parameter as the query', async () => {
            mockFetch.mockResolvedValueOnce(textSearchHit());

            const result = await resolvePlaceIdFromUrl({
                rawUrl: SEARCH_URL,
                apiKey: 'AIza-test'
            });

            expect(result).toEqual({ ok: true, placeId: RESOLVED_PLACE_ID });
            const request = lastTextSearchRequest();
            expect(request.url).toBe('https://places.googleapis.com/v1/places:searchText');
            expect(request.method).toBe('POST');
            expect(request.body.textQuery).toBe('Cheroga Casa Quinta');
        });

        it('sends no locationBias — a search URL carries no @lat,lng token', async () => {
            mockFetch.mockResolvedValueOnce(textSearchHit());

            await resolvePlaceIdFromUrl({ rawUrl: SEARCH_URL, apiKey: 'AIza-test' });

            expect(lastTextSearchRequest().body.locationBias).toBeUndefined();
        });

        it('handles the production share.google chain: canonicalised to a search URL first', async () => {
            canonicalizeIfShortLink.mockResolvedValueOnce(SEARCH_URL);
            mockFetch.mockResolvedValueOnce(textSearchHit());

            const result = await resolvePlaceIdFromUrl({ rawUrl: SHARE_URL, apiKey: 'AIza-test' });

            expect(canonicalizeIfShortLink).toHaveBeenCalledWith(
                expect.objectContaining({ rawUrl: SHARE_URL })
            );
            expect(result).toEqual({ ok: true, placeId: RESOLVED_PLACE_ID });
            expect(lastTextSearchRequest().body.textQuery).toBe('Cheroga Casa Quinta');
        });

        it('reads the wrapped search URL when the chain stops at the /sorry interstitial', async () => {
            const sorryUrl = `https://www.google.com/sorry/index?continue=${encodeURIComponent(SEARCH_URL)}&q=EgQts0kSGKivztcGIjBB4PUB`;
            canonicalizeIfShortLink.mockResolvedValueOnce(sorryUrl);
            mockFetch.mockResolvedValueOnce(textSearchHit());

            const result = await resolvePlaceIdFromUrl({ rawUrl: SHARE_URL, apiKey: 'AIza-test' });

            expect(result).toEqual({ ok: true, placeId: RESOLVED_PLACE_ID });
            expect(lastTextSearchRequest().body.textQuery).toBe('Cheroga Casa Quinta');
        });

        it('refuses a /sorry interstitial whose continue URL is not a Google search', async () => {
            const sorryUrl = `https://www.google.com/sorry/index?continue=${encodeURIComponent('https://evil.example/search?q=x')}&q=tok`;
            canonicalizeIfShortLink.mockResolvedValueOnce(sorryUrl);

            const result = await resolvePlaceIdFromUrl({ rawUrl: SHARE_URL, apiKey: 'AIza-test' });

            expect(result).toEqual({ ok: false, reason: 'unresolvable_url' });
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('returns `not_found` when Text Search answers with zero places', async () => {
            mockFetch.mockResolvedValueOnce(
                new Response(JSON.stringify({ places: [] }), { status: 200 })
            );

            const result = await resolvePlaceIdFromUrl({
                rawUrl: SEARCH_URL,
                apiKey: 'AIza-test'
            });

            expect(result).toEqual({ ok: false, reason: 'not_found' });
        });
    });

    describe('rung 3 — `/maps/place/<name>` is unchanged', () => {
        it('resolves the name from the path and biases by the @lat,lng viewport', async () => {
            mockFetch.mockResolvedValueOnce(textSearchHit());

            const result = await resolvePlaceIdFromUrl({ rawUrl: MAPS_URL, apiKey: 'AIza-test' });

            expect(result).toEqual({ ok: true, placeId: RESOLVED_PLACE_ID });
            const body = lastTextSearchRequest().body;
            expect(body.textQuery).toBe('Cheroga Casa Quinta');
            expect(body.locationBias).toEqual({
                circle: {
                    center: { latitude: -32.4878177, longitude: -58.3626093 },
                    radius: 500
                }
            });
        });
    });

    describe('ladder order — a ChIJ token is preferred over the search fallback', () => {
        it('returns the token without issuing a Text Search request', async () => {
            const tokenUrl = `https://www.google.com/search?q=Cheroga+Casa+Quinta&place_id=${RESOLVED_PLACE_ID}`;

            const result = await resolvePlaceIdFromUrl({ rawUrl: tokenUrl, apiKey: 'AIza-test' });

            expect(result).toEqual({ ok: true, placeId: RESOLVED_PLACE_ID });
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('a `/search` URL with no usable query', () => {
        it('returns `unresolvable_url` and issues no fetch', async () => {
            const result = await resolvePlaceIdFromUrl({
                rawUrl: 'https://www.google.com/search?hl=es',
                apiKey: 'AIza-test'
            });

            expect(result).toEqual({ ok: false, reason: 'unresolvable_url' });
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('treats a whitespace-only `q` as absent', async () => {
            const result = await resolvePlaceIdFromUrl({
                rawUrl: 'https://www.google.com/search?q=%20%20',
                apiKey: 'AIza-test'
            });

            expect(result).toEqual({ ok: false, reason: 'unresolvable_url' });
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });
});

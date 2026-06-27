/**
 * Tests for GooglePlacesAdapter (SPEC-222 T-018)
 *
 * AAA pattern throughout. `fetch` is mocked globally via `vi.stubGlobal` so
 * the adapter never makes real network requests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImportContext } from '../../../../src/services/accommodation-import/adapter.types.js';
import { GooglePlacesAdapter } from '../../../../src/services/accommodation-import/adapters/google-places.adapter.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

/** Minimal valid ImportContext with a Google Places API key. */
function makeCtx(overrides?: Partial<ImportContext>): ImportContext {
    return {
        locale: 'es',
        timeoutMs: 10_000,
        maxBytes: 5_000_000,
        aiMaxChars: 4_000,
        credentials: {
            googlePlacesApiKey: 'test-api-key-abc123'
        },
        ...overrides
    };
}

/** Context with no Google Places API key. */
function makeCtxNoKey(): ImportContext {
    return makeCtx({ credentials: {} });
}

/**
 * Builds a minimal but realistic Places API (New) Place Details response
 * for "Hotel Sol del Litoral" in Concepción del Uruguay, Argentina.
 */
function makePlacesResponse() {
    return {
        displayName: { text: 'Hotel Sol del Litoral', languageCode: 'es' },
        formattedAddress: 'Av. General Urquiza 120, Concepción del Uruguay, Entre Ríos, Argentina',
        location: { latitude: -32.4847, longitude: -58.2376 },
        nationalPhoneNumber: '(0344) 421-0000',
        internationalPhoneNumber: '+54 344 421-0000',
        websiteUri: 'https://hotelsol.com.ar',
        types: ['lodging', 'point_of_interest', 'establishment'],
        addressComponents: [
            {
                longText: 'Av. General Urquiza',
                shortText: 'Av. General Urquiza',
                types: ['route'],
                languageCode: 'es'
            },
            {
                longText: '120',
                shortText: '120',
                types: ['street_number'],
                languageCode: 'es'
            },
            {
                longText: 'Concepción del Uruguay',
                shortText: 'Concepción del Uruguay',
                types: ['locality', 'political'],
                languageCode: 'es'
            },
            {
                longText: 'Entre Ríos',
                shortText: 'ER',
                types: ['administrative_area_level_1', 'political'],
                languageCode: 'es'
            },
            {
                longText: 'Argentina',
                shortText: 'AR',
                types: ['country', 'political'],
                languageCode: 'es'
            }
        ]
    };
}

/** Creates a mock fetch that returns a successful 200 JSON response. */
function mockFetchOk(body: unknown): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(body)
    });
}

/** Creates a mock fetch that returns a non-2xx error response. */
function mockFetchError(status: number): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: vi.fn().mockResolvedValue({ error: { code: status, message: 'Error' } })
    });
}

// ---------------------------------------------------------------------------
// Test setup / teardown
// ---------------------------------------------------------------------------

let adapter: GooglePlacesAdapter;

beforeEach(() => {
    adapter = new GooglePlacesAdapter();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// GooglePlacesAdapter
// ---------------------------------------------------------------------------

describe('GooglePlacesAdapter', () => {
    // -----------------------------------------------------------------------
    // adapter.source
    // -----------------------------------------------------------------------
    describe('source identifier', () => {
        it('should expose source === "google"', () => {
            expect(adapter.source).toBe('google');
        });
    });

    // -----------------------------------------------------------------------
    // supports()
    // -----------------------------------------------------------------------
    describe('supports()', () => {
        describe('when the URL is a Google Maps URL', () => {
            it('should return true for https://www.google.com/maps/place/...', () => {
                // Arrange
                const url = new URL(
                    'https://www.google.com/maps/place/Hotel+Sol/@-32.48,-58.23,17z'
                );

                // Act
                const result = adapter.supports(url);

                // Assert
                expect(result).toBe(true);
            });

            it('should return true for https://google.com/maps/... (no www)', () => {
                const url = new URL('https://google.com/maps/place/SomeHotel');
                expect(adapter.supports(url)).toBe(true);
            });

            it('should return true for https://maps.google.com/... (maps subdomain)', () => {
                const url = new URL('https://maps.google.com/?q=hotel');
                expect(adapter.supports(url)).toBe(true);
            });

            it('should return true for https://maps.google.com.ar/... (regional)', () => {
                const url = new URL('https://maps.google.com.ar/?q=cabana');
                expect(adapter.supports(url)).toBe(true);
            });

            it('should return true for https://goo.gl/maps/... (legacy short-link)', () => {
                const url = new URL('https://goo.gl/maps/AbCdEfGh');
                expect(adapter.supports(url)).toBe(true);
            });

            it('should return true for https://maps.app.goo.gl/... (modern short-link)', () => {
                // Arrange
                const url = new URL('https://maps.app.goo.gl/XyZ1234567890abc');

                // Act
                const result = adapter.supports(url);

                // Assert
                expect(result).toBe(true);
            });

            it('should return true for https://g.page/... (Business Profile short-link)', () => {
                const url = new URL('https://g.page/some-business');
                expect(adapter.supports(url)).toBe(true);
            });
        });

        describe('when the URL is NOT a Google Maps URL', () => {
            it('should return false for https://www.airbnb.com/rooms/12345', () => {
                const url = new URL('https://www.airbnb.com/rooms/12345');
                expect(adapter.supports(url)).toBe(false);
            });

            it('should return false for https://www.booking.com/hotel/ar/x.html', () => {
                const url = new URL('https://www.booking.com/hotel/ar/x.html');
                expect(adapter.supports(url)).toBe(false);
            });

            it('should return false for https://example.com/listing/42', () => {
                const url = new URL('https://example.com/listing/42');
                expect(adapter.supports(url)).toBe(false);
            });

            it('should return false for https://mercadolibre.com.ar/MLA-1', () => {
                const url = new URL('https://mercadolibre.com.ar/MLA-1');
                expect(adapter.supports(url)).toBe(false);
            });
        });
    });

    // -----------------------------------------------------------------------
    // extract() — credential degradation (US-11)
    // -----------------------------------------------------------------------
    describe('extract() — credential degradation', () => {
        it('should return { sourcePlatform: "google" } and NOT call fetch when API key is absent', async () => {
            // Arrange
            const mockFetch = vi.fn();
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                'https://www.google.com/maps/place/Hotel+Sol?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtxNoKey();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — degraded result, no fetch
            expect(result).toStrictEqual({
                sourcePlatform: 'google',
                failureCode: 'credentials_missing'
            });
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should return { sourcePlatform: "google" } when API key is an empty string', async () => {
            // Arrange
            const mockFetch = vi.fn();
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx({ credentials: { googlePlacesApiKey: '' } });

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toStrictEqual({
                sourcePlatform: 'google',
                failureCode: 'credentials_missing'
            });
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // extract() — short-link degradation (MVP limitation)
    // -----------------------------------------------------------------------
    describe('extract() — short-link degradation (MVP)', () => {
        it('should degrade and NOT call fetch for maps.app.goo.gl short-links', async () => {
            // Arrange — short-link with no Place ID in the path
            const mockFetch = vi.fn();
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL('https://maps.app.goo.gl/XyZ1234567890abc');
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — MVP limitation: short-link resolution requires following
            // HTTP redirects which is out of scope. Degrade gracefully.
            expect(result).toStrictEqual({ sourcePlatform: 'google', failureCode: 'invalid_url' });
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should degrade and NOT call fetch for g.page short-links', async () => {
            // Arrange
            const mockFetch = vi.fn();
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL('https://g.page/some-hotel-business');
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toStrictEqual({ sourcePlatform: 'google', failureCode: 'invalid_url' });
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should degrade and NOT call fetch for goo.gl/maps short-links', async () => {
            // Arrange
            const mockFetch = vi.fn();
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL('https://goo.gl/maps/AbCdEfGhIjKlMn');
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toStrictEqual({ sourcePlatform: 'google', failureCode: 'invalid_url' });
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // extract() — successful extraction with place_id query param
    // -----------------------------------------------------------------------
    describe('extract() — successful extraction', () => {
        it('should call the Places API with the correct Place ID from place_id= query param', async () => {
            // Arrange
            const placeId = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(`https://www.google.com/maps/place/Hotel+Sol?place_id=${placeId}`);
            const ctx = makeCtx();

            // Act
            await adapter.extract(url, ctx);

            // Assert — fetch was called with the right URL
            expect(mockFetch).toHaveBeenCalledOnce();
            const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(calledUrl).toBe(
                `https://places.googleapis.com/v1/places/${placeId}?languageCode=es`
            );
        });

        it('should pass the API key in the X-Goog-Api-Key header', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            await adapter.extract(url, ctx);

            // Assert
            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const headers = init?.headers as Record<string, string>;
            expect(headers['X-Goog-Api-Key']).toBe('test-api-key-abc123');
        });

        it('should map name, coordinates, phone and website from the API response', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                'https://www.google.com/maps/place/Hotel+Sol?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.sourcePlatform).toBe('google');

            // Name
            expect(result.name).toStrictEqual({
                value: 'Hotel Sol del Litoral',
                source: 'official_api'
            });

            // Coordinates
            expect(result.location?.coordinates).toStrictEqual({
                value: { lat: '-32.4847', long: '-58.2376' },
                source: 'official_api'
            });

            // Phone (prefers internationalPhoneNumber)
            expect(result.contactInfo?.mobilePhone).toStrictEqual({
                value: '+54 344 421-0000',
                source: 'official_api'
            });

            // Website
            expect(result.contactInfo?.website).toStrictEqual({
                value: 'https://hotelsol.com.ar',
                source: 'official_api'
            });
        });

        it('should populate scrapedLocality from address components', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                'https://www.google.com/maps/place/Hotel+Sol?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — locality extracted from the 'locality' address component
            expect(result.scrapedLocality).toBe('Concepción del Uruguay');
        });

        it('should populate scrapedCountry from address components', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                'https://www.google.com/maps/place/Hotel+Sol?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.scrapedCountry).toBe('Argentina');
        });

        it('should tag all fields with source: "official_api"', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                'https://www.google.com/maps/place/Hotel+Sol?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — every present RawCandidateField uses official_api
            expect(result.name?.source).toBe('official_api');
            expect(result.location?.coordinates?.source).toBe('official_api');
            expect(result.contactInfo?.mobilePhone?.source).toBe('official_api');
            expect(result.contactInfo?.website?.source).toBe('official_api');
        });

        it('should extract a Place ID embedded in the URL path (ChIJ token)', async () => {
            // Arrange — URL without explicit place_id= param; Place ID in path
            const placeId = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                `https://www.google.com/maps/place/Hotel/@-32.48,-58.23,17z/data=!3m1!4b1!4m5!3m4!1s${placeId}!8m2!3d-32.48!4d-58.23`
            );
            const ctx = makeCtx();

            // Act
            await adapter.extract(url, ctx);

            // Assert — correct Place ID extracted from path token
            expect(mockFetch).toHaveBeenCalledOnce();
            const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(calledUrl).toBe(
                `https://places.googleapis.com/v1/places/${placeId}?languageCode=es`
            );
        });
    });

    // -----------------------------------------------------------------------
    // extract() — non-2xx response degradation
    // -----------------------------------------------------------------------
    describe('extract() — non-2xx response', () => {
        it('should return { sourcePlatform: "google" } and not throw on a 403 response', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(403));
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toStrictEqual({
                sourcePlatform: 'google',
                failureCode: 'credentials_missing'
            });
        });

        it('should return { sourcePlatform: "google" } and not throw on a 500 response', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(500));
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act & Assert
            await expect(adapter.extract(url, ctx)).resolves.toStrictEqual({
                sourcePlatform: 'google',
                failureCode: 'provider_error'
            });
        });

        it('should return { sourcePlatform: "google" } when fetch throws (network error)', async () => {
            // Arrange
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act & Assert
            await expect(adapter.extract(url, ctx)).resolves.toStrictEqual({
                sourcePlatform: 'google',
                failureCode: 'provider_error'
            });
        });
    });

    // -----------------------------------------------------------------------
    // extract() — field mask regression (reviews must NEVER be requested)
    // -----------------------------------------------------------------------
    describe('extract() — field mask safety (reviews never requested)', () => {
        it('should NOT include "reviews" in the X-Goog-FieldMask header', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            await adapter.extract(url, ctx);

            // Assert — regression guard: reviews must never appear in the field mask
            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const headers = init?.headers as Record<string, string>;
            const fieldMask = headers['X-Goog-FieldMask'];
            expect(fieldMask).toBeDefined();
            expect(fieldMask).not.toContain('reviews');
        });

        it('should NOT include "rating" in the X-Goog-FieldMask header', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            await adapter.extract(url, ctx);

            // Assert — SPEC-222 hard rule: never fetch ratings
            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const headers = init?.headers as Record<string, string>;
            const fieldMask = headers['X-Goog-FieldMask'];
            expect(fieldMask).not.toContain('rating');
        });

        it('should NOT include "userRatingCount" in the X-Goog-FieldMask header', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            await adapter.extract(url, ctx);

            // Assert
            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const headers = init?.headers as Record<string, string>;
            const fieldMask = headers['X-Goog-FieldMask'];
            expect(fieldMask).not.toContain('userRatingCount');
        });

        it('should NOT map rating/reviews fields even if they somehow appear in the API response', async () => {
            // Arrange — API response with injected review/rating fields (should be ignored)
            const responseWithReviews = {
                ...makePlacesResponse(),
                rating: 4.7,
                userRatingCount: 312,
                reviews: [{ text: { text: 'Great place!' } }]
            };
            vi.stubGlobal('fetch', mockFetchOk(responseWithReviews));
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — no rating or review data should appear in the extraction.
            // Cast via unknown because RawExtraction intentionally has no index
            // signature — we are deliberately probing for fields that must NOT exist.
            const resultObj = result as unknown as Record<string, unknown>;
            expect(resultObj.rating).toBeUndefined();
            expect(resultObj.reviews).toBeUndefined();
            expect(resultObj.userRatingCount).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // extract() — Text Search fallback (ftid hex / 0xHEX:0xHEX URLs)
    // -----------------------------------------------------------------------
    describe('extract() — Text Search fallback (ftid hex token)', () => {
        /**
         * Returns the URL that reproduces the confirmed SPEC-222 live gap:
         * a canonical Google Maps URL resolved from maps.app.goo.gl/dCaudGsZ8r9fKvWk9.
         * The `data=` segment contains `!1s0x95afd9ca9cad4719:0x3a7ad3d3dd8a4428` (ftid
         * hex pair) — NO ChIJ token — so extractPlaceId() returns null and the adapter
         * must fall through to Text Search.
         */
        function makeFtidUrl(): URL {
            return new URL(
                'https://www.google.com/maps/place/Cheroga+Casa+Quinta/@-32.4878131,-58.3626093,732m/data=!3m2!1e3!4b1!4m6!3m5!1s0x95afd9ca9cad4719:0x3a7ad3d3dd8a4428!8m2!3d-32.4878177!4d-58.3600344!16s%2Fg%2F11f6p8d3ql'
            );
        }

        /** A Places API Text Search response containing a single place. */
        function makeTextSearchResponse() {
            return {
                places: [
                    {
                        displayName: { text: 'Cheroga Casa Quinta', languageCode: 'es' },
                        formattedAddress: 'Hernandarias, Entre Ríos, Argentina',
                        location: { latitude: -32.4878177, longitude: -58.3600344 },
                        internationalPhoneNumber: '+54 343 442-0000',
                        websiteUri: 'https://cheroga.com.ar',
                        types: ['lodging', 'point_of_interest', 'establishment'],
                        addressComponents: [
                            {
                                longText: 'Hernandarias',
                                shortText: 'Hernandarias',
                                types: ['locality', 'political'],
                                languageCode: 'es'
                            },
                            {
                                longText: 'Argentina',
                                shortText: 'AR',
                                types: ['country', 'political'],
                                languageCode: 'es'
                            }
                        ]
                    }
                ]
            };
        }

        it('should call Text Search (POST :searchText) when the URL has an ftid hex token and no ChIJ Place ID', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makeTextSearchResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = makeFtidUrl();
            const ctx = makeCtx();

            // Act
            await adapter.extract(url, ctx);

            // Assert — exactly one fetch call, to the Text Search endpoint
            expect(mockFetch).toHaveBeenCalledOnce();
            const [calledUrl, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(calledUrl).toBe('https://places.googleapis.com/v1/places:searchText');
            expect((init as { method?: string }).method).toBe('POST');
        });

        it('should send textQuery with the decoded place name from the URL path', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makeTextSearchResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = makeFtidUrl();
            const ctx = makeCtx();

            // Act
            await adapter.extract(url, ctx);

            // Assert — body contains textQuery = "Cheroga Casa Quinta"
            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const body = JSON.parse((init as { body?: string }).body ?? '{}') as Record<
                string,
                unknown
            >;
            expect(body.textQuery).toBe('Cheroga Casa Quinta');
        });

        it('should include a locationBias circle using the @lat,lng coordinates from the URL', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makeTextSearchResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = makeFtidUrl();
            const ctx = makeCtx();

            // Act
            await adapter.extract(url, ctx);

            // Assert — locationBias circle centred on @-32.4878131,-58.3626093
            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const body = JSON.parse((init as { body?: string }).body ?? '{}') as Record<
                string,
                unknown
            >;
            const bias = (body.locationBias as { circle?: { center?: unknown; radius?: number } })
                ?.circle;
            expect(bias).toBeDefined();
            expect(bias?.center).toStrictEqual({
                latitude: -32.4878131,
                longitude: -58.3626093
            });
            expect(bias?.radius).toBe(500);
        });

        it('should use the places.* field mask prefix in X-Goog-FieldMask for Text Search', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makeTextSearchResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = makeFtidUrl();
            const ctx = makeCtx();

            // Act
            await adapter.extract(url, ctx);

            // Assert — Text Search mask uses `places.` prefix
            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const headers = init?.headers as Record<string, string>;
            const fieldMask = headers['X-Goog-FieldMask'] ?? '';
            expect(fieldMask).toContain('places.displayName');
            expect(fieldMask).not.toContain('places.reviews');
            expect(fieldMask).not.toContain('places.rating');
        });

        it('should map the first Text Search result into a populated RawExtraction', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makeTextSearchResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = makeFtidUrl();
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — draft is populated from places[0], not empty
            expect(result.sourcePlatform).toBe('google');
            expect(result.name).toStrictEqual({
                value: 'Cheroga Casa Quinta',
                source: 'official_api'
            });
            expect(result.location?.coordinates).toStrictEqual({
                value: { lat: '-32.4878177', long: '-58.3600344' },
                source: 'official_api'
            });
            expect(result.scrapedLocality).toBe('Hernandarias');
            expect(result.scrapedCountry).toBe('Argentina');
        });

        it('should degrade to empty extraction when Text Search returns no results', async () => {
            // Arrange — empty places array
            const mockFetch = mockFetchOk({ places: [] });
            vi.stubGlobal('fetch', mockFetch);
            const url = makeFtidUrl();
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — graceful degradation, no throw
            expect(result).toStrictEqual({
                sourcePlatform: 'google',
                failureCode: 'nothing_found'
            });
        });

        it('should degrade to empty extraction when Text Search returns a non-2xx response', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(403));
            const url = makeFtidUrl();
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toStrictEqual({
                sourcePlatform: 'google',
                failureCode: 'nothing_found'
            });
        });

        it('should degrade to empty extraction when Text Search fetch throws (network error)', async () => {
            // Arrange
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));
            const url = makeFtidUrl();
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toStrictEqual({
                sourcePlatform: 'google',
                failureCode: 'nothing_found'
            });
        });

        it('should still use Place Details (not Text Search) for a ChIJ URL — Path A unchanged', async () => {
            // Arrange — URL with a ChIJ Place ID embedded in the data segment
            const placeId = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                `https://www.google.com/maps/place/Hotel/@-32.48,-58.23,17z/data=!3m1!4b1!4m5!3m4!1s${placeId}!8m2!3d-32.48!4d-58.23`
            );
            const ctx = makeCtx();

            // Act
            await adapter.extract(url, ctx);

            // Assert — Place Details GET call, not POST :searchText
            expect(mockFetch).toHaveBeenCalledOnce();
            const [calledUrl, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(calledUrl).toBe(
                `https://places.googleapis.com/v1/places/${placeId}?languageCode=es`
            );
            expect((init as { method?: string }).method).toBe('GET');
        });

        it('should send languageCode in the Text Search body from ctx.locale (SPEC-257)', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makeTextSearchResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = makeFtidUrl();
            const ctx: ImportContext = { ...makeCtx(), locale: 'es' };

            // Act
            await adapter.extract(url, ctx);

            // Assert
            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const body = JSON.parse(init?.body as string) as { languageCode?: string };
            expect(body.languageCode).toBe('es');
        });

        it('should NOT send languageCode in the Text Search body when ctx.locale is absent (SPEC-257)', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makeTextSearchResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = makeFtidUrl();
            const ctx: ImportContext = { ...makeCtx(), locale: undefined };

            // Act
            await adapter.extract(url, ctx);

            // Assert
            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const body = JSON.parse(init?.body as string) as { languageCode?: string };
            expect(body.languageCode).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // extract() — SPEC-257 piece D: localise results via languageCode
    // -----------------------------------------------------------------------
    describe('extract() — SPEC-257 locale', () => {
        it('should append languageCode to the Place Details URL from ctx.locale', async () => {
            // Arrange
            const placeId = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(`https://www.google.com/maps/place/Hotel?place_id=${placeId}`);
            const ctx: ImportContext = { ...makeCtx(), locale: 'pt' };

            // Act
            await adapter.extract(url, ctx);

            // Assert
            const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(calledUrl).toBe(
                `https://places.googleapis.com/v1/places/${placeId}?languageCode=pt`
            );
        });

        it('should NOT add languageCode to Place Details when ctx.locale is absent', async () => {
            // Arrange
            const placeId = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(`https://www.google.com/maps/place/Hotel?place_id=${placeId}`);
            const ctx: ImportContext = { ...makeCtx(), locale: undefined };

            // Act
            await adapter.extract(url, ctx);

            // Assert
            const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(calledUrl).toBe(`https://places.googleapis.com/v1/places/${placeId}`);
        });

        it('should map editorialSummary to the draft summary (SPEC-257)', async () => {
            // Arrange — Places returns a short editorial blurb
            const mockFetch = mockFetchOk({
                displayName: { text: 'Cheroga Casa Quinta' },
                editorialSummary: { text: 'Casa de campo con pileta y parque.', languageCode: 'es' }
            });
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                'https://www.google.com/maps/place/Cheroga?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );

            // Act
            const result = await adapter.extract(url, makeCtx());

            // Assert
            expect(result.summary).toEqual({
                value: 'Casa de campo con pileta y parque.',
                source: 'official_api'
            });
        });

        it('should request editorialSummary in the field mask (SPEC-257)', async () => {
            // Arrange
            const mockFetch = mockFetchOk(makePlacesResponse());
            vi.stubGlobal('fetch', mockFetch);
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );

            // Act
            await adapter.extract(url, makeCtx());

            // Assert — and reviews/rating still NOT requested
            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const mask = (init?.headers as Record<string, string>)['X-Goog-FieldMask'] ?? '';
            expect(mask).toContain('editorialSummary');
            expect(mask).not.toContain('rating');
            expect(mask).not.toContain('reviews');
        });
    });

    // -----------------------------------------------------------------------
    // extract() — partial / sparse API responses
    // -----------------------------------------------------------------------
    describe('extract() — partial API responses', () => {
        it('should degrade gracefully when the API returns an empty object', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchOk({}));
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — only sourcePlatform present
            expect(result.sourcePlatform).toBe('google');
            expect(result.name).toBeUndefined();
            expect(result.location).toBeUndefined();
            expect(result.contactInfo).toBeUndefined();
        });

        it('should fall back to formattedAddress for scrapedLocality when no locality component exists', async () => {
            // Arrange — response with no locality component, only formattedAddress
            const sparseResponse = {
                displayName: { text: 'Some Place' },
                formattedAddress: 'Remote Area, Patagonia, Argentina',
                location: { latitude: -45.0, longitude: -70.0 },
                addressComponents: [
                    {
                        longText: 'Argentina',
                        shortText: 'AR',
                        types: ['country', 'political']
                    }
                ]
            };
            vi.stubGlobal('fetch', mockFetchOk(sparseResponse));
            const url = new URL(
                'https://www.google.com/maps/place/SomePlace?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — formattedAddress used as fallback
            expect(result.scrapedLocality).toBe('Remote Area, Patagonia, Argentina');
        });

        it('should prefer internationalPhoneNumber over nationalPhoneNumber', async () => {
            // Arrange
            const response = {
                ...makePlacesResponse(),
                nationalPhoneNumber: '(0344) 421-0000',
                internationalPhoneNumber: '+54 344 421-0000'
            };
            vi.stubGlobal('fetch', mockFetchOk(response));
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.contactInfo?.mobilePhone?.value).toBe('+54 344 421-0000');
        });

        it('should use nationalPhoneNumber when internationalPhoneNumber is absent', async () => {
            // Arrange
            const { internationalPhoneNumber: _unused, ...responseNoIntl } = makePlacesResponse();
            vi.stubGlobal('fetch', mockFetchOk(responseNoIntl));
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.contactInfo?.mobilePhone?.value).toBe('(0344) 421-0000');
        });
    });

    // -----------------------------------------------------------------------
    // A1 (SPEC-258): place.types[] → raw.type mapping
    // -----------------------------------------------------------------------
    describe('extract() — A1: place.types[] mapped to raw.type (SPEC-258)', () => {
        it('should map types: ["lodging", "hotel", ...] to type HOTEL tagged official_api', async () => {
            // Arrange — "hotel" keyword maps to AccommodationTypeEnum.HOTEL
            const response = {
                ...makePlacesResponse(),
                types: ['lodging', 'hotel', 'point_of_interest', 'establishment']
            };
            vi.stubGlobal('fetch', mockFetchOk(response));
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.type).toStrictEqual({ value: 'HOTEL', source: 'official_api' });
        });

        it('should map types: ["motel", ...] to type MOTEL tagged official_api', async () => {
            // Arrange
            const response = {
                displayName: { text: 'Motel Los Pinos' },
                types: ['motel', 'lodging', 'establishment']
            };
            vi.stubGlobal('fetch', mockFetchOk(response));
            const url = new URL(
                'https://www.google.com/maps/place/Motel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.type).toStrictEqual({ value: 'MOTEL', source: 'official_api' });
        });

        it('should pick the first matching type when multiple types map (first wins)', async () => {
            // Arrange — "hostel" matches before "hotel" because it comes first
            const response = {
                displayName: { text: 'Hostel + Hotel' },
                types: ['hostel', 'hotel', 'lodging']
            };
            vi.stubGlobal('fetch', mockFetchOk(response));
            const url = new URL(
                'https://www.google.com/maps/place/HostelHotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — hostel listed first, so HOSTEL wins over HOTEL
            expect(result.type).toStrictEqual({ value: 'HOSTEL', source: 'official_api' });
        });

        it('should leave raw.type undefined when no type in types[] maps to a known accommodation type', async () => {
            // Arrange — "point_of_interest" and "establishment" do not map
            const response = {
                displayName: { text: 'Generic Business' },
                types: ['point_of_interest', 'establishment']
            };
            vi.stubGlobal('fetch', mockFetchOk(response));
            const url = new URL(
                'https://www.google.com/maps/place/Business?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — no confident type match → field absent
            expect(result.type).toBeUndefined();
        });

        it('should leave raw.type undefined when place.types is absent', async () => {
            // Arrange — response without types field at all
            const { types: _dropped, ...responseNoTypes } = makePlacesResponse();
            vi.stubGlobal('fetch', mockFetchOk(responseNoTypes));
            const url = new URL(
                'https://www.google.com/maps/place/Hotel?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.type).toBeUndefined();
        });

        it('should tag type with source: "official_api"', async () => {
            // Arrange
            const response = { ...makePlacesResponse(), types: ['resort', 'lodging'] };
            vi.stubGlobal('fetch', mockFetchOk(response));
            const url = new URL(
                'https://www.google.com/maps/place/Resort?place_id=ChIJN1t_tDeuEmsRUsoyG83frY4'
            );
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result.type?.source).toBe('official_api');
        });
    });
});

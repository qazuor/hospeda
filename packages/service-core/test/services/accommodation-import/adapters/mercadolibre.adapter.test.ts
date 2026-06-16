/**
 * Unit tests for the MercadoLibre import adapter (SPEC-222 T-017)
 *
 * Verifies that:
 * - `supports()` returns true only for ML/MLivre hostnames.
 * - Missing / empty token → empty extraction, fetch NOT called (US-11).
 * - Unparseable item ID → empty extraction, fetch NOT called.
 * - Item ID with dash form (`MLA-1234567890`) is normalised to `MLA1234567890`.
 * - Happy path: all mapped fields appear in the result tagged `source: 'official_api'`.
 * - Non-2xx API response → empty extraction, no throw.
 * - `fetch` throws (simulated network / timeout error) → empty extraction, no throw.
 * - Rating / review / seller-reputation fields in the payload are NEVER present
 *   in the extraction result (SPEC-222 hard rule).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
    ImportContext,
    RawExtraction
} from '../../../../src/services/accommodation-import/adapter.types.js';
import { MercadoLibreAdapter } from '../../../../src/services/accommodation-import/adapters/mercadolibre.adapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal {@link ImportContext} for tests.
 * Pass `token: undefined` to simulate missing credential (US-11).
 */
function makeCtx(token?: string): ImportContext {
    return {
        timeoutMs: 5_000,
        maxBytes: 1_000_000,
        aiMaxChars: 4_000,
        credentials: {
            mercadoLibreToken: token
        }
    };
}

/**
 * A realistic ML Items API payload with all mapped fields present plus
 * hypothetical rating / review fields that MUST be stripped.
 *
 * Extra fields (ratings, reviews, seller_reputation) are declared as
 * `unknown` additions so TypeScript does not complain about the extra keys —
 * they simulate what a real ML API response might contain.
 */
const ML_ITEM_FULL: Record<string, unknown> = {
    id: 'MLA1234567890',
    title: 'Cabaña con vista al río',
    price: 15000,
    currency_id: 'ARS',
    attributes: [
        { id: 'BEDROOMS', name: 'Dormitorios', value_name: '3' },
        { id: 'BATHROOMS', name: 'Baños', value_name: '2' },
        { id: 'CAPACITY', name: 'Capacidad', value_name: '6' },
        { id: 'AMENITY_WIFI', name: 'WiFi', value_name: 'Sí' } // unknown attr, ignored
    ],
    location: {
        city: { name: 'Concepción del Uruguay' },
        state: { name: 'Entre Ríos' },
        country: { name: 'Argentina' },
        latitude: -32.484,
        longitude: -58.232
    },
    pictures: [
        { secure_url: 'https://cdn.ml.com/secure/img1.jpg', url: 'http://cdn.ml.com/img1.jpg' },
        { url: 'http://cdn.ml.com/img2.jpg' } // no secure_url → fall back to url
    ],
    // ---------- Fields that MUST be stripped per SPEC-222 ----------
    // Hypothetical rating / review keys that some ML categories expose
    rating: { average: 4.8, total: 120 },
    reviews: [{ author: 'user123', text: 'Excelente lugar!' }],
    seller_reputation: { level_id: 'platinum', power_seller_status: 'platinum' },
    feedback: { seller: { goal: 100 } }
};

/**
 * Minimal ML item payload — only the `title` field, everything else absent.
 */
const ML_ITEM_MINIMAL: Record<string, unknown> = {
    id: 'MLA9999',
    title: 'Departamento céntrico'
};

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

/**
 * Creates a mock `fetch` that returns a JSON body with `ok: true` and the
 * given payload.
 */
function mockFetchOk(payload: unknown): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(payload)
    });
}

/**
 * Creates a mock `fetch` that returns a non-2xx response.
 */
function mockFetchNotOk(status = 404): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValueOnce({
        ok: false,
        status,
        json: () => Promise.resolve({ message: 'not found' })
    });
}

/**
 * Creates a mock `fetch` that throws a network error.
 */
function mockFetchThrows(error: Error = new Error('network error')): ReturnType<typeof vi.fn> {
    return vi.fn().mockRejectedValueOnce(error);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MercadoLibreAdapter', () => {
    let adapter: MercadoLibreAdapter;

    beforeEach(() => {
        adapter = new MercadoLibreAdapter();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // supports()
    // -----------------------------------------------------------------------

    describe('supports()', () => {
        it('should return true for articulo.mercadolibre.com.ar', () => {
            expect(
                adapter.supports(new URL('https://articulo.mercadolibre.com.ar/MLA-123-x'))
            ).toBe(true);
        });

        it('should return true for www.mercadolibre.com.mx', () => {
            expect(adapter.supports(new URL('https://www.mercadolibre.com.mx/p/MLM1234'))).toBe(
                true
            );
        });

        it('should return true for produto.mercadolivre.com.br (Brazilian domain)', () => {
            expect(adapter.supports(new URL('https://produto.mercadolivre.com.br/MLB-456-x'))).toBe(
                true
            );
        });

        it('should return true for a bare mercadolibre.com hostname', () => {
            expect(adapter.supports(new URL('https://mercadolibre.com/items/MLA789'))).toBe(true);
        });

        it('should return false for airbnb.com', () => {
            expect(adapter.supports(new URL('https://www.airbnb.com/rooms/12345'))).toBe(false);
        });

        it('should return false for booking.com', () => {
            expect(adapter.supports(new URL('https://www.booking.com/hotel/ar/sol.html'))).toBe(
                false
            );
        });

        it('should return false for an unrelated domain', () => {
            expect(adapter.supports(new URL('https://example.com/listing/42'))).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // extract() — credential degradation (US-11)
    // -----------------------------------------------------------------------

    describe('extract() — missing token', () => {
        it('should return empty extraction when token is undefined and NOT call fetch', async () => {
            // Arrange
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo-_JM');

            // Act
            const result = await adapter.extract(url, makeCtx(undefined));

            // Assert
            expect(result).toStrictEqual<RawExtraction>({ sourcePlatform: 'mercadolibre' });
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('should return empty extraction when token is an empty string and NOT call fetch', async () => {
            // Arrange
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo-_JM');

            // Act
            const result = await adapter.extract(url, makeCtx(''));

            // Assert
            expect(result).toStrictEqual<RawExtraction>({ sourcePlatform: 'mercadolibre' });
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // extract() — item ID parsing
    // -----------------------------------------------------------------------

    describe('extract() — item ID parsing', () => {
        it('should parse dashed form MLA-1234567890 from a real-looking ML URL', async () => {
            // Arrange
            const fetchMock = mockFetchOk(ML_ITEM_MINIMAL);
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo-_JM');

            // Act
            await adapter.extract(url, makeCtx('tok_test'));

            // Assert — fetch must have been called with the normalised (no-dash) ID
            expect(fetchMock).toHaveBeenCalledOnce();
            const [calledUrl] = (fetchMock.mock.calls[0] ?? []) as [string, ...unknown[]];
            expect(calledUrl).toContain('/items/MLA1234567890');
        });

        it('should parse packed form MLA1234567890 from a URL path segment', async () => {
            // Arrange
            const fetchMock = mockFetchOk(ML_ITEM_MINIMAL);
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://www.mercadolibre.com.ar/p/MLA1234567890');

            // Act
            await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(fetchMock).toHaveBeenCalledOnce();
            const [calledUrl] = (fetchMock.mock.calls[0] ?? []) as [string, ...unknown[]];
            expect(calledUrl).toContain('/items/MLA1234567890');
        });

        it('should return empty extraction when no item ID can be found in the URL', async () => {
            // Arrange
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://www.mercadolibre.com.ar/search?q=cabana');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result).toStrictEqual<RawExtraction>({ sourcePlatform: 'mercadolibre' });
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // extract() — happy path
    // -----------------------------------------------------------------------

    describe('extract() — happy path', () => {
        it('should map name, price, currency from a full ML item payload', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchOk(ML_ITEM_FULL));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo-_JM');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result.sourcePlatform).toBe('mercadolibre');
            expect(result.name).toStrictEqual({
                value: 'Cabaña con vista al río',
                source: 'official_api'
            });
            expect(result.price?.price).toStrictEqual({ value: 15000, source: 'official_api' });
            expect(result.price?.currency).toStrictEqual({ value: 'ARS', source: 'official_api' });
        });

        it('should map coordinates from location.latitude / location.longitude as strings', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchOk(ML_ITEM_FULL));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo-_JM');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result.location?.coordinates).toStrictEqual({
                value: { lat: '-32.484', long: '-58.232' },
                source: 'official_api'
            });
        });

        it('should map scrapedLocality from location.city.name', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchOk(ML_ITEM_FULL));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo-_JM');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result.scrapedLocality).toBe('Concepción del Uruguay');
            expect(result.scrapedCountry).toBe('Argentina');
        });

        it('should map imageUrls preferring secure_url over url', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchOk(ML_ITEM_FULL));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo-_JM');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert — first pic has secure_url, second has only url
            expect(result.imageUrls).toStrictEqual([
                'https://cdn.ml.com/secure/img1.jpg',
                'http://cdn.ml.com/img2.jpg'
            ]);
        });

        it('should map BEDROOMS, BATHROOMS, CAPACITY attributes tagged official_api', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchOk(ML_ITEM_FULL));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo-_JM');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result.extraInfo?.bedrooms).toStrictEqual({ value: 3, source: 'official_api' });
            expect(result.extraInfo?.bathrooms).toStrictEqual({ value: 2, source: 'official_api' });
            expect(result.extraInfo?.capacity).toStrictEqual({ value: 6, source: 'official_api' });
        });

        it('should handle a minimal item with only a title', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchOk(ML_ITEM_MINIMAL));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-9999-x');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result.name).toStrictEqual({
                value: 'Departamento céntrico',
                source: 'official_api'
            });
            expect(result.price).toBeUndefined();
            expect(result.imageUrls).toBeUndefined();
            expect(result.extraInfo).toBeUndefined();
        });

        it('should fall back to seller_address when location is absent', async () => {
            // Arrange
            const itemWithSellerAddress: Record<string, unknown> = {
                id: 'MLA5555',
                title: 'Casa amplia',
                seller_address: {
                    city: { name: 'Paraná' },
                    country: { name: 'Argentina' },
                    latitude: -31.7333,
                    longitude: -60.5333
                }
            };
            vi.stubGlobal('fetch', mockFetchOk(itemWithSellerAddress));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-5555-x');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result.scrapedLocality).toBe('Paraná');
            expect(result.location?.coordinates).toStrictEqual({
                value: { lat: '-31.7333', long: '-60.5333' },
                source: 'official_api'
            });
        });

        it('should send Authorization: Bearer header', async () => {
            // Arrange
            const fetchMock = mockFetchOk(ML_ITEM_MINIMAL);
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-9999-x');

            // Act
            await adapter.extract(url, makeCtx('my_secret_token'));

            // Assert
            const [, options] = (fetchMock.mock.calls[0] ?? []) as [string, RequestInit];
            expect((options.headers as Record<string, string>)?.Authorization).toBe(
                'Bearer my_secret_token'
            );
        });
    });

    // -----------------------------------------------------------------------
    // extract() — non-2xx response
    // -----------------------------------------------------------------------

    describe('extract() — non-2xx response', () => {
        it('should return empty extraction on a 404 response without throwing', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchNotOk(404));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result).toStrictEqual<RawExtraction>({ sourcePlatform: 'mercadolibre' });
        });

        it('should return empty extraction on a 500 response without throwing', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchNotOk(500));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result).toStrictEqual<RawExtraction>({ sourcePlatform: 'mercadolibre' });
        });
    });

    // -----------------------------------------------------------------------
    // extract() — fetch throws (network / timeout)
    // -----------------------------------------------------------------------

    describe('extract() — fetch error', () => {
        it('should return empty extraction when fetch throws a network error without rethrowing', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchThrows(new Error('ECONNREFUSED')));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result).toStrictEqual<RawExtraction>({ sourcePlatform: 'mercadolibre' });
        });

        it('should return empty extraction when fetch throws an AbortError (timeout) without rethrowing', async () => {
            // Arrange
            const abortError = new DOMException('signal timed out', 'AbortError');
            vi.stubGlobal('fetch', mockFetchThrows(abortError));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result).toStrictEqual<RawExtraction>({ sourcePlatform: 'mercadolibre' });
        });
    });

    // -----------------------------------------------------------------------
    // SPEC-222 hard rule — no rating / review fields in extraction
    // -----------------------------------------------------------------------

    describe('extract() — SPEC-222 hard rule: no ratings / reviews', () => {
        it('should NOT include any rating-like keys in the result even when present in the API response', async () => {
            // Arrange — ML_ITEM_FULL contains rating, reviews, seller_reputation, feedback
            vi.stubGlobal('fetch', mockFetchOk(ML_ITEM_FULL));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));
            const resultAsRecord = result as unknown as Record<string, unknown>;

            // Assert — none of these keys should appear anywhere in the result
            const forbiddenKeys = [
                'rating',
                'ratings',
                'ratingValue',
                'reviews',
                'review',
                'aggregateRating',
                'reviewCount',
                'starRating',
                'seller_reputation',
                'feedback'
            ];
            for (const key of forbiddenKeys) {
                expect(
                    resultAsRecord[key],
                    `key "${key}" must not appear in RawExtraction`
                ).toBeUndefined();
            }
        });
    });
});

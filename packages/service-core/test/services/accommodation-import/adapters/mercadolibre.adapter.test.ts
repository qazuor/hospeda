/**
 * Unit tests for the MercadoLibre import adapter (SPEC-222 T-017)
 *
 * Verifies that:
 * - `supports()` returns true only for ML/MLivre hostnames.
 * - Missing token provider → empty extraction, fetch NOT called (US-11).
 * - A token provider that rejects → empty extraction, fetch NOT called (HOS-45).
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
 * Pass `token: undefined` to simulate a missing token provider (US-11).
 * Pass a string to get a provider that resolves with that token value.
 */
function makeCtx(token?: string): ImportContext {
    return {
        timeoutMs: 5_000,
        maxBytes: 1_000_000,
        aiMaxChars: 4_000,
        credentials: {},
        ...(token === undefined ? {} : { mercadoLibreTokenProvider: async () => token })
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

/**
 * ML item carrying BOTH `BEDROOMS` (dormitorios) and `ROOMS` (ambientes),
 * with `ROOMS` listed last — the exact ordering that made the old
 * last-one-wins loop report 5 bedrooms for a 3-bedroom listing (HOS-286).
 */
const ML_ITEM_BEDROOMS_AND_ROOMS: Record<string, unknown> = {
    id: 'MLA1771107139',
    title: 'Casa 3 dormitorios',
    attributes: [
        { id: 'BEDROOMS', name: 'Dormitorios', value_name: '3' },
        { id: 'ROOMS', name: 'Ambientes', value_name: '5' }
    ]
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
 * Creates a mock `fetch` that resolves each queued payload in order, one per
 * call. Used for the two-call flow (`/items/{id}` then
 * `/items/{id}/description`).
 */
function mockFetchOkSequence(payloads: readonly unknown[]): ReturnType<typeof vi.fn> {
    const mock = vi.fn();
    for (const payload of payloads) {
        mock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(payload) });
    }
    return mock;
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
        // `restoreAllMocks` does NOT undo `vi.stubGlobal` — without this, the
        // `setTimeout` wrapper installed by the deadline test below leaks into
        // every subsequent test in this file.
        vi.unstubAllGlobals();
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
        it('should return empty extraction when mercadoLibreTokenProvider is absent and NOT call fetch', async () => {
            // Arrange
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo-_JM');

            // Act
            const result = await adapter.extract(url, makeCtx(undefined));

            // Assert
            expect(result).toStrictEqual<RawExtraction>({
                sourcePlatform: 'mercadolibre',
                failureCode: 'credentials_missing'
            });
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('should return empty extraction when mercadoLibreTokenProvider rejects and NOT call fetch', async () => {
            // Arrange
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo-_JM');
            const ctx: ImportContext = {
                ...makeCtx(undefined),
                mercadoLibreTokenProvider: vi
                    .fn()
                    .mockRejectedValue(new Error('token refresh failed'))
            };

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toStrictEqual<RawExtraction>({
                sourcePlatform: 'mercadolibre',
                failureCode: 'credentials_missing'
            });
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

            // Assert — the item call (first of the two) uses the normalised
            // (no-dash) ID. The second call is the description endpoint (HOS-286).
            const [calledUrl] = (fetchMock.mock.calls[0] ?? []) as [string, ...unknown[]];
            expect(calledUrl).toBe('https://api.mercadolibre.com/items/MLA1234567890');
        });

        it('should parse packed form MLA1234567890 from a URL path segment', async () => {
            // Arrange
            const fetchMock = mockFetchOk(ML_ITEM_MINIMAL);
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://www.mercadolibre.com.ar/p/MLA1234567890');

            // Act
            await adapter.extract(url, makeCtx('tok_test'));

            // Assert — the item call is the first of the two (see HOS-286).
            const [calledUrl] = (fetchMock.mock.calls[0] ?? []) as [string, ...unknown[]];
            expect(calledUrl).toBe('https://api.mercadolibre.com/items/MLA1234567890');
        });

        it('should return empty extraction when no item ID can be found in the URL', async () => {
            // Arrange
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://www.mercadolibre.com.ar/search?q=cabana');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result).toStrictEqual<RawExtraction>({
                sourcePlatform: 'mercadolibre',
                failureCode: 'nothing_found'
            });
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
            expect(result).toStrictEqual<RawExtraction>({
                sourcePlatform: 'mercadolibre',
                failureCode: 'nothing_found'
            });
        });

        it('should return empty extraction on a 500 response without throwing', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchNotOk(500));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result).toStrictEqual<RawExtraction>({
                sourcePlatform: 'mercadolibre',
                failureCode: 'provider_error'
            });
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
            expect(result).toStrictEqual<RawExtraction>({
                sourcePlatform: 'mercadolibre',
                failureCode: 'provider_error'
            });
        });

        it('should return empty extraction when fetch throws an AbortError (timeout) without rethrowing', async () => {
            // Arrange
            const abortError = new DOMException('signal timed out', 'AbortError');
            vi.stubGlobal('fetch', mockFetchThrows(abortError));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result).toStrictEqual<RawExtraction>({
                sourcePlatform: 'mercadolibre',
                failureCode: 'timeout'
            });
        });
    });

    // -----------------------------------------------------------------------
    // extract() — bedrooms vs. "Ambientes" (HOS-286.3)
    // -----------------------------------------------------------------------

    describe('extract() — bedroom attribute mapping (HOS-286)', () => {
        it('should map BEDROOMS and ignore ROOMS ("Ambientes") even when ROOMS comes last', async () => {
            // Arrange — real-world ordering that caused the bug: ROOMS after BEDROOMS.
            vi.stubGlobal('fetch', mockFetchOk(ML_ITEM_BEDROOMS_AND_ROOMS));
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert — 3 dormitorios, NOT the 5 "ambientes" that used to overwrite them.
            expect(result.extraInfo?.bedrooms).toStrictEqual({ value: 3, source: 'official_api' });
        });

        it('should not map bedrooms at all when only ROOMS ("Ambientes") is present', async () => {
            // Arrange
            vi.stubGlobal(
                'fetch',
                mockFetchOk({
                    id: 'MLA1',
                    title: 'Depto 4 ambientes',
                    attributes: [{ id: 'ROOMS', name: 'Ambientes', value_name: '4' }]
                })
            );
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert — "Ambientes" is not a bedroom count and has no field of its own.
            expect(result.extraInfo?.bedrooms).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // extract() — description endpoint (HOS-286.1)
    // -----------------------------------------------------------------------

    describe('extract() — description endpoint (HOS-286)', () => {
        it('should give the description call only what is LEFT of the budget', async () => {
            // Arrange — `extract` is contractually bound to resolve within
            // ctx.timeoutMs, and the two fetches run sequentially. The second
            // must therefore spend the REMAINDER of the budget, not a fresh
            // share of it (full + 50% would still be 1.5x the contract). Make
            // the item call burn measurable time so the remainder is observable.
            const ITEM_CALL_MS = 120;
            const timeouts: number[] = [];
            const realSetTimeout = globalThis.setTimeout;
            vi.stubGlobal('setTimeout', ((fn: () => void, ms: number) => {
                timeouts.push(ms);
                return realSetTimeout(fn, ms);
            }) as unknown as typeof globalThis.setTimeout);
            const fetchMock = vi
                .fn()
                .mockImplementationOnce(
                    () =>
                        new Promise((resolve) => {
                            realSetTimeout(
                                () =>
                                    resolve({
                                        ok: true,
                                        json: () => Promise.resolve(ML_ITEM_MINIMAL)
                                    }),
                                ITEM_CALL_MS
                            );
                        })
                )
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ plain_text: 'x'.repeat(60) })
                });
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            await adapter.extract(url, makeCtx('tok_test'));

            // Assert the CONTRACT, not the current numbers: both calls draw on
            // one shared budget, so together they can never exceed it. Asserting
            // `itemBudget === 5000` instead would pin a fresh-timer-per-call
            // regression as if it were the spec.
            const [itemBudget, descriptionBudget] = timeouts as [number, number];
            expect(itemBudget).toBeLessThanOrEqual(5_000);
            expect(descriptionBudget).toBeLessThanOrEqual(5_000 - ITEM_CALL_MS);
            // Two-sided: an upper bound alone is satisfied by any proportional
            // share (a 50% split is also "≤ 5000 - 120").
            expect(descriptionBudget).toBeGreaterThan(5_000 - ITEM_CALL_MS - 200);
        });

        it('should skip the description call when the budget is already spent', async () => {
            // Arrange — an item call that consumes the whole budget must not be
            // followed by a second fetch that overruns it.
            const fetchMock = vi
                .fn()
                .mockImplementationOnce(
                    () =>
                        new Promise((resolve) => {
                            setTimeout(
                                () =>
                                    resolve({
                                        ok: true,
                                        json: () => Promise.resolve(ML_ITEM_FULL)
                                    }),
                                60
                            );
                        })
                )
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ plain_text: 'x'.repeat(60) })
                });
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');
            const ctx: ImportContext = { ...makeCtx('tok_test'), timeoutMs: 50 };

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — only the item call was made; the extraction still stands.
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(result.description).toBeUndefined();
            expect(result.name?.value).toBe('Cabaña con vista al río');
        });

        it('should call /items/{id}/description with the same Bearer token', async () => {
            // Arrange
            const fetchMock = mockFetchOkSequence([
                ML_ITEM_MINIMAL,
                { plain_text: 'Una casa muy linda frente al río, ideal para descansar.' }
            ]);
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(fetchMock).toHaveBeenCalledTimes(2);
            const [descUrl, descInit] = (fetchMock.mock.calls[1] ?? []) as [
                string,
                { headers: Record<string, string> }
            ];
            expect(descUrl).toBe('https://api.mercadolibre.com/items/MLA1234567890/description');
            expect(descInit.headers.Authorization).toBe('Bearer tok_test');
        });

        it('should map plain_text to both description and summary', async () => {
            // Arrange
            const plainText = 'Una casa muy linda frente al río, ideal para descansar en familia.';
            vi.stubGlobal(
                'fetch',
                mockFetchOkSequence([ML_ITEM_MINIMAL, { plain_text: plainText }])
            );
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result.description).toStrictEqual({
                value: plainText,
                source: 'official_api'
            });
            expect(result.summary).toStrictEqual({ value: plainText, source: 'official_api' });
        });

        it('should truncate the summary at a word boundary so it fits the 300-char cap', async () => {
            // Arrange — 600 chars of real words, well past the summary cap.
            const longText = 'palabra '.repeat(75).trim();
            vi.stubGlobal(
                'fetch',
                mockFetchOkSequence([ML_ITEM_MINIMAL, { plain_text: longText }])
            );
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));
            const summary = result.summary?.value as string;

            // Assert — within the cap, ends with an ellipsis, and never cuts mid-word.
            expect(summary.length).toBeLessThanOrEqual(300);
            expect(summary.endsWith('…')).toBe(true);
            expect(summary.slice(0, -1).trim().endsWith('palabra')).toBe(true);
        });

        it('should truncate the description at the 2000-char accommodation cap', async () => {
            // Arrange — 4000 chars, double the accommodation `description` max.
            const veryLongText = 'palabra '.repeat(500).trim();
            vi.stubGlobal(
                'fetch',
                mockFetchOkSequence([ML_ITEM_MINIMAL, { plain_text: veryLongText }])
            );
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));
            const description = result.description?.value as string;

            // Assert
            expect(description.length).toBeLessThanOrEqual(2000);
            expect(description.endsWith('…')).toBe(true);
        });

        it('should keep the item extraction when the description endpoint returns 404', async () => {
            // Arrange
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ML_ITEM_FULL) })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 404,
                    json: () => Promise.resolve({ message: 'not found' })
                });
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert — best-effort: no description, but the import is NOT broken.
            expect(result.description).toBeUndefined();
            expect(result.summary).toBeUndefined();
            expect(result.failureCode).toBeUndefined();
            expect(result.name).toStrictEqual({
                value: 'Cabaña con vista al río',
                source: 'official_api'
            });
        });

        it('should keep the item extraction when the description fetch throws', async () => {
            // Arrange
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ML_ITEM_FULL) })
                .mockRejectedValueOnce(new Error('network error'));
            vi.stubGlobal('fetch', fetchMock);
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result.description).toBeUndefined();
            expect(result.failureCode).toBeUndefined();
            expect(result.name?.value).toBe('Cabaña con vista al río');
        });

        it('should omit a description that is under the accommodation minimum', async () => {
            // Arrange — a one-line seller description, very common on ML.
            // Pre-filling 23 chars into a min-30 field would hand the host a
            // form they cannot submit on a field they never filled in.
            vi.stubGlobal(
                'fetch',
                mockFetchOkSequence([ML_ITEM_MINIMAL, { plain_text: 'Consultar por WhatsApp.' }])
            );
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert — summary clears its own 10-char minimum, description does not.
            expect(result.description).toBeUndefined();
            expect(result.summary?.value).toBe('Consultar por WhatsApp.');
        });

        it('should ignore a blank plain_text', async () => {
            // Arrange
            vi.stubGlobal(
                'fetch',
                mockFetchOkSequence([ML_ITEM_MINIMAL, { plain_text: '   \n  ' }])
            );
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert
            expect(result.description).toBeUndefined();
            expect(result.summary).toBeUndefined();
        });

        it('should collapse newlines when deriving the single-line summary', async () => {
            // Arrange
            vi.stubGlobal(
                'fetch',
                mockFetchOkSequence([
                    ML_ITEM_MINIMAL,
                    { plain_text: 'Primera línea.\n\nSegunda línea.' }
                ])
            );
            const url = new URL('https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo');

            // Act
            const result = await adapter.extract(url, makeCtx('tok_test'));

            // Assert — summary is a one-liner; description keeps its paragraph break.
            expect(result.summary?.value).toBe('Primera línea. Segunda línea.');
            expect(result.description?.value).toBe('Primera línea.\n\nSegunda línea.');
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

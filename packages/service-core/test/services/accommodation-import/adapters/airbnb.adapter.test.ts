/**
 * Unit tests for the Airbnb import adapter (SPEC-222 T-016)
 *
 * The `apify-client` module is mocked with `vi.mock` so that `runApifyActor`
 * never makes real HTTP calls.  The adapter is tested in full isolation.
 *
 * Covers:
 * - `supports()` true for airbnb.com / airbnb.com.ar / airbnb.mx etc.
 * - `supports()` false for booking.com, google.com, unrelated domains.
 * - Missing `apifyToken` → degraded extraction, `runApifyActor` NOT called.
 * - Missing `apifyAirbnbActor` → degraded extraction, `runApifyActor` NOT called.
 * - Both credentials absent → degraded extraction, NOT called.
 * - Empty dataset (`[]`) → degraded empty extraction.
 * - Happy path: all expected fields are mapped, tagged `source: 'official_api'`.
 * - A dataset item that includes reviews/rating/ratingBreakdown/etc. →
 *   NONE of those fields appear anywhere in the returned RawExtraction
 *   (SPEC-222 hard rule).
 * - SPEC-258 A1/A1b (tri_angle/airbnb-rooms-urls-scraper real shape):
 *   - Amenities flattening: `available:false` entries in "Not included" group are excluded.
 *   - Image extraction via `imageUrl` field (NOT `url`) on image objects.
 *   - Full real-probe-shaped item: all fields map correctly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImportContext } from '../../../../src/services/accommodation-import/adapter.types.js';
import { AirbnbAdapter } from '../../../../src/services/accommodation-import/adapters/airbnb.adapter.js';

// ---------------------------------------------------------------------------
// Mock the apify-client module so no real HTTP calls occur
// ---------------------------------------------------------------------------

vi.mock('../../../../src/services/accommodation-import/adapters/apify-client.js', () => ({
    runApifyActor: vi.fn()
}));

// Import the mock reference AFTER vi.mock so TypeScript and vitest are aligned
import { runApifyActor } from '../../../../src/services/accommodation-import/adapters/apify-client.js';

const mockRunApifyActor = vi.mocked(runApifyActor);

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal valid {@link ImportContext} with both Apify credentials set.
 */
function makeCtx(overrides?: Partial<ImportContext['credentials']>): ImportContext {
    return {
        locale: 'es',
        timeoutMs: 15_000,
        maxBytes: 5_000_000,
        aiMaxChars: 4_000,
        credentials: {
            apifyToken: 'test-apify-token',
            apifyAirbnbActor: 'apify/airbnb-scraper',
            ...overrides
        }
    };
}

/**
 * A realistic Airbnb actor dataset item with all mappable fields present PLUS
 * several review/rating fields that MUST be stripped (SPEC-222 hard rule).
 *
 * The extra keys are declared via `Record<string, unknown>` so TypeScript
 * accepts them — they simulate what a real Apify actor might return.
 */
const AIRBNB_ITEM_FULL: Record<string, unknown> = {
    // --- Mapped fields ---
    name: 'Cabaña del Río',
    description: 'Hermosa cabaña con vista al río Gualeguaychú.',
    lat: -32.9643,
    lng: -58.5217,
    address: 'Concepción del Uruguay',
    country: 'Argentina',
    photos: ['https://cdn.airbnb.com/img/photo1.jpg', 'https://cdn.airbnb.com/img/photo2.jpg'],
    roomType: 'Entire cabin',
    personCapacity: 6,
    bedrooms: 3,
    bathrooms: 2,
    price: 4500,

    // --- Fields that MUST be stripped per SPEC-222 ---
    rating: 4.87,
    reviewsCount: 203,
    ratingBreakdown: {
        accuracy: 4.9,
        cleanliness: 5.0,
        checkin: 4.8,
        communication: 4.9,
        location: 4.7,
        value: 4.8
    },
    reviews: [{ author: 'user_abc', text: 'Increíble lugar!', date: '2025-01-01' }],
    starRating: 5,
    reviewsList: [{ id: 'r1', rating: 5 }],
    guestSatisfactionOverall: 97
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AirbnbAdapter', () => {
    let adapter: AirbnbAdapter;

    beforeEach(() => {
        adapter = new AirbnbAdapter();
        mockRunApifyActor.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // supports()
    // -----------------------------------------------------------------------

    describe('supports()', () => {
        it('should return true for airbnb.com', () => {
            expect(adapter.supports(new URL('https://www.airbnb.com/rooms/12345'))).toBe(true);
        });

        it('should return true for airbnb.com.ar', () => {
            expect(adapter.supports(new URL('https://www.airbnb.com.ar/rooms/12345'))).toBe(true);
        });

        it('should return true for airbnb.mx', () => {
            expect(adapter.supports(new URL('https://www.airbnb.mx/rooms/12345'))).toBe(true);
        });

        it('should return true for airbnb.co.uk', () => {
            expect(adapter.supports(new URL('https://www.airbnb.co.uk/rooms/12345'))).toBe(true);
        });

        it('should return false for booking.com', () => {
            expect(adapter.supports(new URL('https://www.booking.com/hotel/ar/x'))).toBe(false);
        });

        it('should return false for google.com', () => {
            expect(adapter.supports(new URL('https://www.google.com/maps/place/foo'))).toBe(false);
        });

        it('should return false for an unrelated domain', () => {
            expect(adapter.supports(new URL('https://www.example.com/property/1'))).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // extract() — credential degradation (US-11)
    // -----------------------------------------------------------------------

    describe('extract() — credential degradation', () => {
        it('should return degraded extraction when apifyToken is absent', async () => {
            // Arrange
            const ctx = makeCtx({ apifyToken: undefined });
            const url = new URL('https://www.airbnb.com/rooms/12345');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toEqual({
                sourcePlatform: 'airbnb',
                failureCode: 'credentials_missing'
            });
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });

        it('should return degraded extraction when apifyToken is empty string', async () => {
            // Arrange
            const ctx = makeCtx({ apifyToken: '' });
            const url = new URL('https://www.airbnb.com/rooms/12345');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toEqual({
                sourcePlatform: 'airbnb',
                failureCode: 'credentials_missing'
            });
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });

        it('should return degraded extraction when apifyAirbnbActor is absent', async () => {
            // Arrange
            const ctx = makeCtx({ apifyAirbnbActor: undefined });
            const url = new URL('https://www.airbnb.com/rooms/12345');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toEqual({
                sourcePlatform: 'airbnb',
                failureCode: 'credentials_missing'
            });
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });

        it('should return degraded extraction when apifyAirbnbActor is empty string', async () => {
            // Arrange
            const ctx = makeCtx({ apifyAirbnbActor: '' });
            const url = new URL('https://www.airbnb.com/rooms/12345');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toEqual({
                sourcePlatform: 'airbnb',
                failureCode: 'credentials_missing'
            });
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });

        it('should return degraded extraction when both credentials are absent', async () => {
            // Arrange
            const ctx = makeCtx({ apifyToken: undefined, apifyAirbnbActor: undefined });
            const url = new URL('https://www.airbnb.com/rooms/12345');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toEqual({
                sourcePlatform: 'airbnb',
                failureCode: 'credentials_missing'
            });
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // extract() — empty dataset
    // -----------------------------------------------------------------------

    describe('extract() — empty dataset', () => {
        it('should return degraded extraction when the actor returns an empty array', async () => {
            // Arrange
            mockRunApifyActor.mockResolvedValue({ items: [] });
            const ctx = makeCtx();
            const url = new URL('https://www.airbnb.com/rooms/12345');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toEqual({ sourcePlatform: 'airbnb', failureCode: 'source_blocked' });
            expect(mockRunApifyActor).toHaveBeenCalledOnce();
        });
    });

    // -----------------------------------------------------------------------
    // extract() — happy path
    // -----------------------------------------------------------------------

    describe('extract() — happy path', () => {
        it('should map name, description, type, coords, images, capacity from a full dataset item', async () => {
            // Arrange
            mockRunApifyActor.mockResolvedValue({ items: [AIRBNB_ITEM_FULL] });
            const ctx = makeCtx();
            const url = new URL('https://www.airbnb.com/rooms/99999');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — basic shape
            expect(result.sourcePlatform).toBe('airbnb');

            // name
            expect(result.name).toEqual({ value: 'Cabaña del Río', source: 'official_api' });

            // description
            expect(result.description).toEqual({
                value: 'Hermosa cabaña con vista al río Gualeguaychú.',
                source: 'official_api'
            });

            // type
            expect(result.type).toEqual({ value: 'Entire cabin', source: 'official_api' });

            // coordinates
            expect(result.location?.coordinates?.source).toBe('official_api');
            const coords = result.location?.coordinates?.value as { lat: string; long: string };
            expect(Number(coords.lat)).toBeCloseTo(-32.9643, 4);
            expect(Number(coords.long)).toBeCloseTo(-58.5217, 4);

            // scrapedLocality and country
            expect(result.scrapedLocality).toBe('Concepción del Uruguay');
            expect(result.scrapedCountry).toBe('Argentina');

            // imageUrls
            expect(result.imageUrls).toEqual([
                'https://cdn.airbnb.com/img/photo1.jpg',
                'https://cdn.airbnb.com/img/photo2.jpg'
            ]);

            // extraInfo
            expect(result.extraInfo?.capacity).toEqual({ value: 6, source: 'official_api' });
            expect(result.extraInfo?.bedrooms).toEqual({ value: 3, source: 'official_api' });
            expect(result.extraInfo?.bathrooms).toEqual({ value: 2, source: 'official_api' });

            // price — flat numeric `price: 4500` is treated as the stay total;
            // PRICE_PROBE_NIGHTS (2) are used to derive per-night: 4500 / 2 = 2250.
            // Tagged 'text' (50% confidence) — orientative estimate, not authoritative.
            expect(result.price?.price).toEqual({ value: 2250, source: 'text' });
        });

        it('should use title as name fallback when name field is absent', async () => {
            // Arrange
            const item: Record<string, unknown> = {
                title: 'Apartamento céntrico',
                description: 'Desc'
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result.name?.value).toBe('Apartamento céntrico');
        });

        it('should read nested coordinates when flat lat/lng are absent', async () => {
            // Arrange
            const item: Record<string, unknown> = {
                name: 'Test',
                coordinates: { lat: -33.0, lng: -60.0 }
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            const coords = result.location?.coordinates?.value as { lat: string; long: string };
            expect(Number(coords.lat)).toBeCloseTo(-33.0, 5);
            expect(Number(coords.long)).toBeCloseTo(-60.0, 5);
        });

        it('should fall back to images array when photos is absent', async () => {
            // Arrange
            const item: Record<string, unknown> = {
                name: 'Test',
                images: [{ url: 'https://cdn.airbnb.com/img/a.jpg' }]
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result.imageUrls).toEqual(['https://cdn.airbnb.com/img/a.jpg']);
        });

        it('should extract price from a nested pricing object', async () => {
            // Arrange
            const item: Record<string, unknown> = {
                name: 'Test',
                pricing: { rate: 2500 }
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result.price?.price?.value).toBe(2500);
        });

        it('should pass the listing URL unchanged in the actorInput startUrls', async () => {
            // Arrange
            mockRunApifyActor.mockResolvedValue({ items: [] });
            const url = new URL('https://www.airbnb.com/rooms/77777');
            const ctx = makeCtx();

            // Act
            await adapter.extract(url, ctx);

            // Assert — URL is passed verbatim (locale goes in the actor input, NOT
            // the URL — a ?locale= query breaks the tri_angle actor).
            const callArg = mockRunApifyActor.mock.calls[0]?.[0];
            const startUrls = (callArg?.actorInput as { startUrls: { url: string }[] }).startUrls;
            expect(startUrls[0]?.url).toBe(url.href);
            expect(startUrls[0]?.url).not.toContain('locale=');
        });

        it('should include price-probe date params in actorInput (SPEC-258)', async () => {
            // Arrange
            mockRunApifyActor.mockResolvedValue({ items: [] });

            // Act
            await adapter.extract(new URL('https://www.airbnb.com/rooms/77777'), makeCtx());

            // Assert — checkIn/checkOut are YYYY-MM-DD; adults and currency are fixed.
            const callArg = mockRunApifyActor.mock.calls[0]?.[0];
            expect(callArg?.actorInput).toMatchObject({
                checkIn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
                checkOut: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
                adults: 2,
                currency: 'USD'
            });
        });
    });

    // -----------------------------------------------------------------------
    // extract() — SPEC-222 hard rule: no reviews/ratings in result
    // -----------------------------------------------------------------------

    describe('extract() — SPEC-222 reviews/ratings must be stripped', () => {
        it('should not include rating, reviewsCount, ratingBreakdown, reviews, starRating, reviewsList, or guestSatisfactionOverall when the dataset item contains them', async () => {
            // Arrange — AIRBNB_ITEM_FULL has all those forbidden keys
            mockRunApifyActor.mockResolvedValue({ items: [AIRBNB_ITEM_FULL] });
            const ctx = makeCtx();
            const url = new URL('https://www.airbnb.com/rooms/99999');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — none of the forbidden keys appear anywhere in the result
            const serialised = JSON.stringify(result);

            expect(serialised).not.toContain('"rating"');
            expect(serialised).not.toContain('"reviewsCount"');
            expect(serialised).not.toContain('"ratingBreakdown"');
            expect(serialised).not.toContain('"reviews"');
            expect(serialised).not.toContain('"starRating"');
            expect(serialised).not.toContain('"reviewsList"');
            expect(serialised).not.toContain('"guestSatisfactionOverall"');

            // Belt-and-suspenders: direct key checks on the result object
            expect(result).not.toHaveProperty('rating');
            expect(result).not.toHaveProperty('reviewsCount');
            expect(result).not.toHaveProperty('ratingBreakdown');
            expect(result).not.toHaveProperty('reviews');
            expect(result).not.toHaveProperty('starRating');
            expect(result).not.toHaveProperty('reviewsList');
            expect(result).not.toHaveProperty('guestSatisfactionOverall');
        });
    });

    // -----------------------------------------------------------------------
    // extract() — SPEC-257 enrichment: summary, amenityNames, beds
    // -----------------------------------------------------------------------

    describe('extract() — SPEC-257 enrichment', () => {
        it('should map summary from the summary field', async () => {
            // Arrange
            const item: Record<string, unknown> = {
                name: 'Test',
                summary: 'A cozy riverside cabin.'
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result.summary).toEqual({
                value: 'A cozy riverside cabin.',
                source: 'official_api'
            });
        });

        it('should fall back to publicDescription for summary', async () => {
            // Arrange
            const item: Record<string, unknown> = {
                name: 'Test',
                publicDescription: 'Fallback summary text.'
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result.summary?.value).toBe('Fallback summary text.');
        });

        it('should map amenityNames from a plain string array', async () => {
            // Arrange
            const item: Record<string, unknown> = {
                name: 'Test',
                amenities: ['WiFi', 'Pool', 'Air conditioning']
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result.amenityNames).toEqual(['WiFi', 'Pool', 'Air conditioning']);
        });

        it('should map amenityNames from objects and skip unavailable ones', async () => {
            // Arrange
            const item: Record<string, unknown> = {
                name: 'Test',
                amenities: [
                    { title: 'WiFi', available: true },
                    { name: 'Kitchen' },
                    { title: 'Hot tub', available: false }
                ]
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert — unavailable "Hot tub" is dropped
            expect(result.amenityNames).toEqual(['WiFi', 'Kitchen']);
        });

        it('should flatten grouped amenities (values arrays) and dedupe', async () => {
            // Arrange
            const item: Record<string, unknown> = {
                name: 'Test',
                amenities: [
                    { title: 'Bathroom', values: ['Shampoo', 'Hot water'] },
                    { title: 'Kitchen', values: [{ title: 'Hot water' }, { title: 'Oven' }] }
                ]
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert — flattened, "Hot water" deduped
            expect(result.amenityNames).toEqual(['Shampoo', 'Hot water', 'Oven']);
        });

        it('should map beds to extraInfo.beds', async () => {
            // Arrange
            const item: Record<string, unknown> = {
                name: 'Test',
                beds: 4
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result.extraInfo?.beds).toEqual({ value: 4, source: 'official_api' });
        });

        it('should fall back to metaDescription for summary (tri_angle actor)', async () => {
            // Arrange — the real tri_angle actor exposes metaDescription, not summary
            const item: Record<string, unknown> = {
                title: 'Casa',
                metaDescription: 'Cheroga te ofrece tranquilidad y espacios naturales.'
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result.summary?.value).toBe(
                'Cheroga te ofrece tranquilidad y espacios naturales.'
            );
        });

        it('should map scrapedLocality from the location string (tri_angle actor)', async () => {
            // Arrange
            const item: Record<string, unknown> = {
                title: 'Casa',
                location: 'Concepción del Uruguay'
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result.scrapedLocality).toBe('Concepción del Uruguay');
        });

        it('should parse capacity/bedrooms/beds/bathrooms from subDescription.items (English)', async () => {
            // Arrange — tri_angle capacity line
            const item: Record<string, unknown> = {
                title: 'Casa',
                subDescription: { items: ['11 guests', '3 bedrooms', '8 beds', '1 bath'] }
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result.extraInfo?.capacity).toEqual({ value: 11, source: 'official_api' });
            expect(result.extraInfo?.bedrooms).toEqual({ value: 3, source: 'official_api' });
            expect(result.extraInfo?.beds).toEqual({ value: 8, source: 'official_api' });
            expect(result.extraInfo?.bathrooms).toEqual({ value: 1, source: 'official_api' });
        });

        it('should parse subDescription.items in Spanish', async () => {
            // Arrange — localized capacity line
            const item: Record<string, unknown> = {
                title: 'Casa',
                subDescription: { items: ['11 huéspedes', '3 habitaciones', '8 camas', '1 baño'] }
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result.extraInfo?.capacity?.value).toBe(11);
            expect(result.extraInfo?.bedrooms?.value).toBe(3);
            expect(result.extraInfo?.beds?.value).toBe(8);
            expect(result.extraInfo?.bathrooms?.value).toBe(1);
        });

        it('should prefer top-level capacity fields over subDescription', async () => {
            // Arrange — both present; top-level wins
            const item: Record<string, unknown> = {
                title: 'Casa',
                personCapacity: 4,
                subDescription: { items: ['11 guests', '2 bedrooms'] }
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert — capacity from top-level (4), bedrooms from subDescription (2)
            expect(result.extraInfo?.capacity?.value).toBe(4);
            expect(result.extraInfo?.bedrooms?.value).toBe(2);
        });

        it('should map grouped tri_angle amenities (title/values/available)', async () => {
            // Arrange — the real actor amenities shape
            const item: Record<string, unknown> = {
                title: 'Casa',
                amenities: [
                    {
                        title: 'Scenic views',
                        values: [
                            { title: 'Garden view', available: true },
                            { title: 'Pool view', available: true }
                        ]
                    },
                    { title: 'Bathroom', values: [{ title: 'Body soap', available: true }] }
                ]
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result.amenityNames).toEqual(['Garden view', 'Pool view', 'Body soap']);
        });

        it('should exclude amenities with available:false from grouped values (real probe shape)', async () => {
            // Arrange — real probe includes a "Not included" group with available:false entries
            // (SPEC-258: tri_angle/airbnb-rooms-urls-scraper real shape)
            const item: Record<string, unknown> = {
                title: 'Casa',
                amenities: [
                    {
                        title: 'Internet and office',
                        values: [
                            { title: 'Wifi', subtitle: '', icon: 'SYSTEM_WI_FI', available: true },
                            {
                                title: 'Dedicated workspace',
                                subtitle: 'In a common space',
                                icon: 'SYSTEM_WORKSPACE',
                                available: true
                            }
                        ]
                    },
                    {
                        title: 'Not included',
                        values: [
                            {
                                title: 'Washer',
                                subtitle: '',
                                icon: 'SYSTEM_NO_WASHER',
                                available: false
                            },
                            {
                                title: 'Dryer',
                                subtitle: '',
                                icon: 'SYSTEM_NO_DRYER',
                                available: false
                            },
                            {
                                title: 'Smoke alarm',
                                subtitle: 'This place may not have a smoke detector.',
                                icon: 'SYSTEM_NO_DETECTOR_SMOKE',
                                available: false
                            }
                        ]
                    }
                ]
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert — "Not included" amenities (available:false) are excluded
            expect(result.amenityNames).toEqual(['Wifi', 'Dedicated workspace']);
            expect(result.amenityNames).not.toContain('Washer');
            expect(result.amenityNames).not.toContain('Dryer');
            expect(result.amenityNames).not.toContain('Smoke alarm');
        });

        it('should extract imageUrl field from rooms-urls-scraper image objects (real probe shape)', async () => {
            // Arrange — tri_angle/airbnb-rooms-urls-scraper returns
            // { caption, imageUrl, orientation } objects, NOT { url } objects
            const item: Record<string, unknown> = {
                title: 'Beautiful Country House with pool',
                coordinates: { latitude: -32.4873, longitude: -58.36 },
                images: [
                    {
                        caption: 'Listing image 1',
                        imageUrl:
                            'https://a0.muscache.com/im/pictures/miso/Hosting-817515602448448452/original/27b6b3ab.jpeg',
                        orientation: 'LANDSCAPE'
                    },
                    {
                        caption: 'Listing image 2',
                        imageUrl:
                            'https://a0.muscache.com/im/pictures/miso/Hosting-817515602448448452/original/6b100b88.jpeg',
                        orientation: 'LANDSCAPE'
                    }
                ]
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/817515602448448452'),
                makeCtx()
            );

            // Assert — imageUrl field is correctly extracted
            expect(result.imageUrls).toEqual([
                'https://a0.muscache.com/im/pictures/miso/Hosting-817515602448448452/original/27b6b3ab.jpeg',
                'https://a0.muscache.com/im/pictures/miso/Hosting-817515602448448452/original/6b100b88.jpeg'
            ]);
        });

        it('should map all key fields from a full real-probe-shaped rooms-urls-scraper item', async () => {
            // Arrange — trimmed-but-faithful copy of the live probe (SPEC-258)
            const item: Record<string, unknown> = {
                title: 'Beautiful Country House with pool and large ground',
                description: 'Cheroga offers you tranquility, privacy and natural spaces.',
                metaDescription: 'Jun 23, 2026 · Entire cottage · Cheroga offers you tranquility.',
                propertyType: 'Entire cottage',
                roomType: 'Entire home/apt',
                personCapacity: 11,
                coordinates: { latitude: -32.4873, longitude: -58.36 },
                location: 'Concepción del Uruguay',
                subDescription: {
                    title: 'Entire cottage in Concepción del Uruguay, Argentina',
                    items: ['11 guests', '3 bedrooms', '8 beds', '1 bath']
                },
                images: [
                    {
                        caption: 'Listing image 1',
                        imageUrl: 'https://a0.muscache.com/im/pictures/miso/photo1.jpeg',
                        orientation: 'LANDSCAPE'
                    },
                    {
                        caption: 'Listing image 2',
                        imageUrl: 'https://a0.muscache.com/im/pictures/miso/photo2.jpeg',
                        orientation: 'LANDSCAPE'
                    }
                ],
                amenities: [
                    {
                        title: 'Scenic views',
                        values: [
                            {
                                title: 'Courtyard view',
                                subtitle: '',
                                icon: 'SYSTEM_FLOWER',
                                available: true
                            },
                            {
                                title: 'Garden view',
                                subtitle: '',
                                icon: 'SYSTEM_FLOWER',
                                available: true
                            }
                        ]
                    },
                    {
                        title: 'Internet and office',
                        values: [
                            { title: 'Wifi', subtitle: '', icon: 'SYSTEM_WI_FI', available: true }
                        ]
                    },
                    {
                        title: 'Not included',
                        values: [
                            {
                                title: 'Washer',
                                subtitle: '',
                                icon: 'SYSTEM_NO_WASHER',
                                available: false
                            },
                            {
                                title: 'Dryer',
                                subtitle: '',
                                icon: 'SYSTEM_NO_DRYER',
                                available: false
                            }
                        ]
                    }
                ]
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/817515602448448452'),
                makeCtx()
            );

            // Assert — all expected fields mapped
            expect(result.sourcePlatform).toBe('airbnb');
            expect(result.name?.value).toBe('Beautiful Country House with pool and large ground');
            expect(result.description?.value).toBe(
                'Cheroga offers you tranquility, privacy and natural spaces.'
            );
            // summary from metaDescription fallback
            expect(result.summary?.value).toContain('Cheroga offers you tranquility');
            // type prefers propertyType
            expect(result.type?.value).toBe('Entire cottage');
            // coordinates from nested coordinates object
            const coords = result.location?.coordinates?.value as { lat: string; long: string };
            expect(Number(coords.lat)).toBeCloseTo(-32.4873, 4);
            expect(Number(coords.long)).toBeCloseTo(-58.36, 4);
            // scrapedLocality from location string
            expect(result.scrapedLocality).toBe('Concepción del Uruguay');
            // images via imageUrl field
            expect(result.imageUrls).toHaveLength(2);
            expect(result.imageUrls?.[0]).toContain('photo1.jpeg');
            // capacity from personCapacity (top-level)
            expect(result.extraInfo?.capacity?.value).toBe(11);
            // bedrooms/beds/bathrooms from subDescription.items
            expect(result.extraInfo?.bedrooms?.value).toBe(3);
            expect(result.extraInfo?.beds?.value).toBe(8);
            expect(result.extraInfo?.bathrooms?.value).toBe(1);
            // amenities: only available:true values
            expect(result.amenityNames).toContain('Courtyard view');
            expect(result.amenityNames).toContain('Garden view');
            expect(result.amenityNames).toContain('Wifi');
            expect(result.amenityNames).not.toContain('Washer');
            expect(result.amenityNames).not.toContain('Dryer');
        });

        it('should omit summary, amenityNames and beds when absent', async () => {
            // Arrange — a minimal item with none of the enrichment fields
            const item: Record<string, unknown> = { name: 'Test' };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result).not.toHaveProperty('summary');
            expect(result).not.toHaveProperty('amenityNames');
            expect(result.extraInfo?.beds).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // extract() — SPEC-257 piece D: localise via actor INPUT (not the URL)
    // -----------------------------------------------------------------------

    describe('extract() — SPEC-257 locale', () => {
        it('should pass locale es-AR as actor input for ctx.locale "es"', async () => {
            // Arrange
            mockRunApifyActor.mockResolvedValue({ items: [] });
            const url = new URL('https://www.airbnb.com.ar/rooms/77777');
            const ctx: ImportContext = { ...makeCtx(), locale: 'es' };

            // Act
            await adapter.extract(url, ctx);

            // Assert — locale goes in the actor input, mapped to es-AR; URL untouched
            const input = mockRunApifyActor.mock.calls[0]?.[0]?.actorInput as {
                startUrls: { url: string }[];
                locale?: string;
            };
            expect(input.locale).toBe('es-AR');
            expect(input.startUrls[0]?.url).toBe(url.href);
            expect(input.startUrls[0]?.url).not.toContain('locale=');
        });

        it('should map pt -> pt-BR and en -> en', async () => {
            // pt
            mockRunApifyActor.mockResolvedValue({ items: [] });
            await adapter.extract(new URL('https://www.airbnb.com/rooms/1'), {
                ...makeCtx(),
                locale: 'pt'
            });
            expect(
                (mockRunApifyActor.mock.calls[0]?.[0]?.actorInput as { locale?: string }).locale
            ).toBe('pt-BR');

            // en
            mockRunApifyActor.mockClear();
            mockRunApifyActor.mockResolvedValue({ items: [] });
            await adapter.extract(new URL('https://www.airbnb.com/rooms/1'), {
                ...makeCtx(),
                locale: 'en'
            });
            expect(
                (mockRunApifyActor.mock.calls[0]?.[0]?.actorInput as { locale?: string }).locale
            ).toBe('en');
        });

        it('should not set a locale in the actor input when ctx.locale is absent', async () => {
            // Arrange
            mockRunApifyActor.mockResolvedValue({ items: [] });
            const ctx: ImportContext = { ...makeCtx(), locale: undefined };

            // Act
            await adapter.extract(new URL('https://www.airbnb.com/rooms/1'), ctx);

            // Assert
            const input = mockRunApifyActor.mock.calls[0]?.[0]?.actorInput as { locale?: string };
            expect(input.locale).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // SPEC-258 price probe — Airbnb per-night price extraction
    // -----------------------------------------------------------------------

    describe('SPEC-258 price probe — Airbnb per-night price from breakDown', () => {
        it('should parse per-night price from breakDown.basePrice.description ("N nights x $X")', async () => {
            // Arrange — real probe shape from tri_angle/airbnb-rooms-urls-scraper
            // with checkIn/checkOut sent. breakDown.basePrice.description contains
            // the per-night rate: "2 nights x $157.32" → 157.32 per night.
            const item: Record<string, unknown> = {
                name: 'Cabaña del Río',
                price: {
                    label: '$157',
                    qualifier: 'per night',
                    price: '$314',
                    breakDown: {
                        basePrice: {
                            description: '2 nights x $157.32',
                            price: '$314.64'
                        },
                        total: {
                            description: 'Total',
                            price: '$314.64'
                        }
                    }
                }
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert — parsed from "2 nights x $157.32".
            // Tagged 'text' (50% confidence) — date-specific estimate, not authoritative.
            expect(result.price?.price?.value).toBeCloseTo(157.32, 2);
            expect(result.price?.price?.source).toBe('text');
            expect(result.price?.currency).toEqual({ value: 'USD', source: 'text' });
        });

        it('should not emit price when actor returns a placeholder label (no dates sent)', async () => {
            // Arrange — when no checkIn/checkOut are sent, the actor returns a
            // placeholder price object with no numeric value.
            const item: Record<string, unknown> = {
                name: 'Cabaña del Río',
                price: {
                    label: 'To get prices, enter your dates.',
                    qualifier: null,
                    price: null
                }
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert — no price candidate emitted
            expect(result.price).toBeUndefined();
        });

        it('should reject European thousands-period format "$1.200" (ambiguous) → no price', async () => {
            // Arrange — "$1.200" has three decimal places after the dot; the
            // strict parser rejects it (would be mis-parsed as 1.2, not 1200).
            const item: Record<string, unknown> = {
                name: 'Casa Europea',
                price: {
                    breakDown: {
                        basePrice: { description: '2 nights x $1.200', price: '$2.400' }
                    }
                }
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert — ambiguous format rejected; no price emitted
            expect(result.price).toBeUndefined();
        });

        it('should parse "$1,200.00" total over 2 nights → 600/night', async () => {
            // Arrange — standard US comma-thousands format; safe to parse.
            const item: Record<string, unknown> = {
                name: 'Villa Premium',
                price: {
                    breakDown: {
                        total: { description: 'Total', price: '$1,200.00' }
                    }
                }
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert — 1200 ÷ 2 nights = 600/night
            expect(result.price?.price?.value).toBeCloseTo(600, 2);
            expect(result.price?.price?.source).toBe('text');
        });

        it('should not emit price when computed per-night value is below $1 (floor guard)', async () => {
            // Arrange — a very small total (e.g. "0.50" for 2 nights = 0.25/night)
            // backstops any residual mis-parse.
            const item: Record<string, unknown> = {
                name: 'Tiny Price',
                price: {
                    breakDown: {
                        total: { description: 'Total', price: '$0.50' }
                    }
                }
            };
            mockRunApifyActor.mockResolvedValue({ items: [item] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert — 0.50 ÷ 2 = 0.25 < 1 → rejected by floor guard
            expect(result.price).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // R1 retry integration (SPEC-277)
    // -----------------------------------------------------------------------

    describe('R1 retry integration', () => {
        /**
         * Fake-timer helpers are scoped INSIDE this describe so the real-timer
         * behavior of every other describe block is completely undisturbed.
         *
         * Pattern used per test:
         *   vi.useFakeTimers();
         *   const p = adapter.extract(url, ctx);
         *   await vi.runAllTimersAsync();   // drains the sleep() inside withRetry
         *   const result = await p;
         *   vi.useRealTimers();
         */

        const url = new URL('https://www.airbnb.com/rooms/99999');

        it('should succeed on the 3rd attempt after two source_blocked results', async () => {
            // Arrange — first two calls return source_blocked (retryable),
            // third call returns a valid dataset item.
            mockRunApifyActor
                .mockResolvedValueOnce({ items: [], failureCode: 'source_blocked' })
                .mockResolvedValueOnce({ items: [], failureCode: 'source_blocked' })
                .mockResolvedValueOnce({ items: [AIRBNB_ITEM_FULL] });
            const ctx = makeCtx();

            // Act — start the promise, flush fake timers to skip sleep(), then await
            vi.useFakeTimers();
            const p = adapter.extract(url, ctx);
            await vi.runAllTimersAsync();
            const result = await p;
            vi.useRealTimers();

            // Assert — extraction is successful (no failureCode, name mapped)
            expect(result.sourcePlatform).toBe('airbnb');
            expect(result.failureCode).toBeUndefined();
            expect(result.name?.value).toBe('Cabaña del Río');

            // Exactly 3 calls: 1 initial + 2 retries
            expect(mockRunApifyActor).toHaveBeenCalledTimes(3);
        });

        it('should return source_blocked after exhausting all 3 attempts', async () => {
            // Arrange — all three calls return source_blocked
            mockRunApifyActor
                .mockResolvedValueOnce({ items: [], failureCode: 'source_blocked' })
                .mockResolvedValueOnce({ items: [], failureCode: 'source_blocked' })
                .mockResolvedValueOnce({ items: [], failureCode: 'source_blocked' });
            const ctx = makeCtx();

            // Act
            vi.useFakeTimers();
            const p = adapter.extract(url, ctx);
            await vi.runAllTimersAsync();
            const result = await p;
            vi.useRealTimers();

            // Assert — adapter propagates the last failure code
            expect(result).toEqual({ sourcePlatform: 'airbnb', failureCode: 'source_blocked' });

            // Retry cap enforced: exactly 3 calls (1 + 2 retries = cap)
            expect(mockRunApifyActor).toHaveBeenCalledTimes(3);
        });

        it('should not retry credentials_missing and return immediately after 1 call', async () => {
            // Arrange — non-retryable failure code on first call
            mockRunApifyActor.mockResolvedValueOnce({
                items: [],
                failureCode: 'credentials_missing'
            });
            const ctx = makeCtx();

            // Act — no fake timers needed (no sleep will occur), but use them
            // defensively to ensure any accidental sleep would not block the test
            vi.useFakeTimers();
            const p = adapter.extract(url, ctx);
            await vi.runAllTimersAsync();
            const result = await p;
            vi.useRealTimers();

            // Assert — fail-fast: returned on first call, no retry
            expect(result).toEqual({
                sourcePlatform: 'airbnb',
                failureCode: 'credentials_missing'
            });
            expect(mockRunApifyActor).toHaveBeenCalledTimes(1);
        });
    });

    describe('extract() — Apify timeout budget', () => {
        it('passes apifyTimeoutMs to runApifyActor when set, not the short fetch timeout', async () => {
            // Arrange — fetch timeout short (8s), Apify budget long (120s)
            mockRunApifyActor.mockResolvedValue({ items: [AIRBNB_ITEM_FULL] });
            const ctx: ImportContext = { ...makeCtx(), timeoutMs: 8_000, apifyTimeoutMs: 120_000 };
            const url = new URL('https://www.airbnb.com/rooms/99999');

            // Act
            await adapter.extract(url, ctx);

            // Assert — the actor run gets the long budget, not the 8s fetch timeout
            expect(mockRunApifyActor).toHaveBeenCalledWith(
                expect.objectContaining({ timeoutMs: 120_000 })
            );
        });

        it('falls back to timeoutMs when apifyTimeoutMs is absent', async () => {
            // Arrange — legacy context without apifyTimeoutMs
            mockRunApifyActor.mockResolvedValue({ items: [AIRBNB_ITEM_FULL] });
            const ctx = makeCtx();
            const url = new URL('https://www.airbnb.com/rooms/99999');

            // Act
            await adapter.extract(url, ctx);

            // Assert — falls back to the fetch timeout (15s in makeCtx)
            expect(mockRunApifyActor).toHaveBeenCalledWith(
                expect.objectContaining({ timeoutMs: 15_000 })
            );
        });
    });
});

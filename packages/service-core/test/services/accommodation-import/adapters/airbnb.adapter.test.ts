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
            expect(result).toEqual({ sourcePlatform: 'airbnb' });
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });

        it('should return degraded extraction when apifyToken is empty string', async () => {
            // Arrange
            const ctx = makeCtx({ apifyToken: '' });
            const url = new URL('https://www.airbnb.com/rooms/12345');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toEqual({ sourcePlatform: 'airbnb' });
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });

        it('should return degraded extraction when apifyAirbnbActor is absent', async () => {
            // Arrange
            const ctx = makeCtx({ apifyAirbnbActor: undefined });
            const url = new URL('https://www.airbnb.com/rooms/12345');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toEqual({ sourcePlatform: 'airbnb' });
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });

        it('should return degraded extraction when apifyAirbnbActor is empty string', async () => {
            // Arrange
            const ctx = makeCtx({ apifyAirbnbActor: '' });
            const url = new URL('https://www.airbnb.com/rooms/12345');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toEqual({ sourcePlatform: 'airbnb' });
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });

        it('should return degraded extraction when both credentials are absent', async () => {
            // Arrange
            const ctx = makeCtx({ apifyToken: undefined, apifyAirbnbActor: undefined });
            const url = new URL('https://www.airbnb.com/rooms/12345');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toEqual({ sourcePlatform: 'airbnb' });
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // extract() — empty dataset
    // -----------------------------------------------------------------------

    describe('extract() — empty dataset', () => {
        it('should return degraded extraction when the actor returns an empty array', async () => {
            // Arrange
            mockRunApifyActor.mockResolvedValue([]);
            const ctx = makeCtx();
            const url = new URL('https://www.airbnb.com/rooms/12345');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert
            expect(result).toEqual({ sourcePlatform: 'airbnb' });
            expect(mockRunApifyActor).toHaveBeenCalledOnce();
        });
    });

    // -----------------------------------------------------------------------
    // extract() — happy path
    // -----------------------------------------------------------------------

    describe('extract() — happy path', () => {
        it('should map name, description, type, coords, images, capacity from a full dataset item', async () => {
            // Arrange
            mockRunApifyActor.mockResolvedValue([AIRBNB_ITEM_FULL]);
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

            // price
            expect(result.price?.price).toEqual({ value: 4500, source: 'official_api' });
        });

        it('should use title as name fallback when name field is absent', async () => {
            // Arrange
            const item: Record<string, unknown> = {
                title: 'Apartamento céntrico',
                description: 'Desc'
            };
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([]);
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
    });

    // -----------------------------------------------------------------------
    // extract() — SPEC-222 hard rule: no reviews/ratings in result
    // -----------------------------------------------------------------------

    describe('extract() — SPEC-222 reviews/ratings must be stripped', () => {
        it('should not include rating, reviewsCount, ratingBreakdown, reviews, starRating, reviewsList, or guestSatisfactionOverall when the dataset item contains them', async () => {
            // Arrange — AIRBNB_ITEM_FULL has all those forbidden keys
            mockRunApifyActor.mockResolvedValue([AIRBNB_ITEM_FULL]);
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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([item]);

            // Act
            const result = await adapter.extract(
                new URL('https://www.airbnb.com/rooms/1'),
                makeCtx()
            );

            // Assert
            expect(result.amenityNames).toEqual(['Garden view', 'Pool view', 'Body soap']);
        });

        it('should omit summary, amenityNames and beds when absent', async () => {
            // Arrange — a minimal item with none of the enrichment fields
            const item: Record<string, unknown> = { name: 'Test' };
            mockRunApifyActor.mockResolvedValue([item]);

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
            mockRunApifyActor.mockResolvedValue([]);
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
            mockRunApifyActor.mockResolvedValue([]);
            await adapter.extract(new URL('https://www.airbnb.com/rooms/1'), {
                ...makeCtx(),
                locale: 'pt'
            });
            expect(
                (mockRunApifyActor.mock.calls[0]?.[0]?.actorInput as { locale?: string }).locale
            ).toBe('pt-BR');

            // en
            mockRunApifyActor.mockClear();
            mockRunApifyActor.mockResolvedValue([]);
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
            mockRunApifyActor.mockResolvedValue([]);
            const ctx: ImportContext = { ...makeCtx(), locale: undefined };

            // Act
            await adapter.extract(new URL('https://www.airbnb.com/rooms/1'), ctx);

            // Assert
            const input = mockRunApifyActor.mock.calls[0]?.[0]?.actorInput as { locale?: string };
            expect(input.locale).toBeUndefined();
        });
    });
});

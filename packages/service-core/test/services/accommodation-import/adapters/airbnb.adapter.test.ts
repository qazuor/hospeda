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

        it('should pass the listing URL in the actorInput startUrls', async () => {
            // Arrange
            mockRunApifyActor.mockResolvedValue([]);
            const url = new URL('https://www.airbnb.com/rooms/77777');
            const ctx = makeCtx();

            // Act
            await adapter.extract(url, ctx);

            // Assert
            expect(mockRunApifyActor).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorInput: { startUrls: [{ url: url.href }] }
                })
            );
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
});

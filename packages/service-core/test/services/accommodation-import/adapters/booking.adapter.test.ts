/**
 * Unit tests for the Booking.com import adapter (SPEC-222 T-015)
 *
 * Both `@repo/utils` (safeExternalFetch) and the `apify-client` module
 * (runApifyActor) are mocked with `vi.mock` so no real HTTP calls occur.
 * The adapter is tested in full isolation.
 *
 * Covers:
 * - `supports()` true for booking.com variants; false for airbnb/google/other.
 * - Primary success: JSON-LD with ≥2 useful fields → result tagged `jsonld`;
 *   `runApifyActor` NOT called.
 * - Blocked primary fetch + Apify creds present → Apify called, result tagged
 *   `official_api`.
 * - Blocked primary fetch + Apify creds absent → `{ sourcePlatform: 'booking' }`;
 *   no throw.
 * - JSON-LD body containing aggregateRating/review → assert absent in result.
 * - Apify dataset item containing rating/reviews → assert absent in result.
 * - Everything fails (blocked fetch + empty Apify dataset) → degraded, no throw.
 * - Threshold: JSON-LD with exactly 1 useful field → Apify fallback triggered.
 * - Both credentials absent after insufficient primary → degraded (not Apify).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImportContext } from '../../../../src/services/accommodation-import/adapter.types.js';
import { BookingAdapter } from '../../../../src/services/accommodation-import/adapters/booking.adapter.js';

// ---------------------------------------------------------------------------
// Mock safeExternalFetch from @repo/utils
// ---------------------------------------------------------------------------

vi.mock('@repo/utils', () => ({
    safeExternalFetch: vi.fn()
}));

import { safeExternalFetch } from '@repo/utils';

const mockSafeExternalFetch = vi.mocked(safeExternalFetch);

// ---------------------------------------------------------------------------
// Mock the apify-client module so no real HTTP calls occur
// ---------------------------------------------------------------------------

vi.mock('../../../../src/services/accommodation-import/adapters/apify-client.js', () => ({
    runApifyActor: vi.fn()
}));

import { runApifyActor } from '../../../../src/services/accommodation-import/adapters/apify-client.js';

const mockRunApifyActor = vi.mocked(runApifyActor);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal valid {@link ImportContext} with both Apify Booking credentials set.
 */
function makeCtx(overrides?: Partial<ImportContext['credentials']>): ImportContext {
    return {
        locale: 'es',
        timeoutMs: 15_000,
        maxBytes: 5_000_000,
        aiMaxChars: 4_000,
        credentials: {
            apifyToken: 'test-apify-token',
            apifyBookingActor: 'voyager/booking-scraper',
            ...overrides
        }
    };
}

/**
 * A minimal HTML page with a JSON-LD Hotel block containing ≥2 useful fields
 * (name + address/locality → scrapedLocality counts).
 *
 * Also includes `aggregateRating` and `review` to verify they are stripped
 * by `extractJsonLd` before this adapter returns.
 */
const HTML_WITH_JSONLD_HOTEL = `<!DOCTYPE html><html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Hotel",
  "name": "Hotel del Rio Booking",
  "description": "Un hotel junto al río Paraná.",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Av. Costanera 123",
    "addressLocality": "Concepción del Uruguay",
    "addressCountry": "AR"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": -32.4825,
    "longitude": -58.2375
  },
  "image": [
    "https://cf.bstatic.com/photo1.jpg",
    "https://cf.bstatic.com/photo2.jpg"
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "8.7",
    "reviewCount": "1240"
  },
  "review": [
    { "@type": "Review", "reviewBody": "Excelente lugar.", "author": "Viajero" }
  ]
}
</script>
</head><body></body></html>`;

/**
 * An HTML page with JSON-LD that has only ONE useful field (name).
 * This should trigger the Apify fallback.
 */
const HTML_WITH_SPARSE_JSONLD = `<!DOCTYPE html><html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Hotel",
  "name": "Hotel Sparse"
}
</script>
</head><body></body></html>`;

/**
 * A Booking.com Apify dataset item with all mappable fields present PLUS
 * several review/rating fields that MUST NOT appear in the result (SPEC-222).
 */
const BOOKING_APIFY_ITEM_FULL: Record<string, unknown> = {
    // -- Mapped fields --
    name: 'Alojamiento Booking Apify',
    description: 'Alojamiento con pileta y jardín.',
    lat: -32.4825,
    lng: -58.2375,
    address: 'Concepción del Uruguay',
    country: 'Argentina',
    photos: ['https://cf.bstatic.com/apify-photo1.jpg', 'https://cf.bstatic.com/apify-photo2.jpg'],
    propertyType: 'Hotel',
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 1,

    // -- Fields that MUST be absent per SPEC-222 --
    rating: 8.7,
    reviewsCount: 312,
    guestRating: 8.5,
    reviewScore: 8.7,
    starRating: 4,
    reviews: [{ author: 'usuario1', text: 'Muy bueno', date: '2025-03-01' }],
    ratingBreakdown: { cleanliness: 9.0, comfort: 8.5 }
};

// ---------------------------------------------------------------------------
// Helper — build a SafeFetchSuccess-shaped mock result
// ---------------------------------------------------------------------------

function fetchOk(body: string) {
    return { ok: true as const, status: 200, body, finalUrl: 'https://www.booking.com/hotel/ar/x' };
}

function fetchBlocked(error = 'Bot detection') {
    return { ok: false as const, status: 0 as const, error, blocked: true as const };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BookingAdapter', () => {
    let adapter: BookingAdapter;

    beforeEach(() => {
        adapter = new BookingAdapter();
        mockSafeExternalFetch.mockReset();
        mockRunApifyActor.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // supports()
    // -----------------------------------------------------------------------

    describe('supports()', () => {
        it('should return true for booking.com', () => {
            expect(adapter.supports(new URL('https://www.booking.com/hotel/ar/x'))).toBe(true);
        });

        it('should return true for booking.com.ar', () => {
            expect(adapter.supports(new URL('https://www.booking.com.ar/hotel/ar/x'))).toBe(true);
        });

        it('should return true for secure.booking.com (subdomain)', () => {
            expect(adapter.supports(new URL('https://secure.booking.com/hotel/ar/x'))).toBe(true);
        });

        it('should return false for airbnb.com', () => {
            expect(adapter.supports(new URL('https://www.airbnb.com/rooms/12345'))).toBe(false);
        });

        it('should return false for google.com', () => {
            expect(adapter.supports(new URL('https://www.google.com/maps/place/foo'))).toBe(false);
        });

        it('should return false for an unrelated domain', () => {
            expect(adapter.supports(new URL('https://www.example.com/property/1'))).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // extract() — primary success (JSON-LD with ≥2 useful fields)
    // -----------------------------------------------------------------------

    describe('extract() — primary JSON-LD success', () => {
        it('should return JSON-LD mapped result when fetch succeeds and yields ≥2 useful fields', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValue(fetchOk(HTML_WITH_JSONLD_HOTEL));
            const ctx = makeCtx();
            const url = new URL('https://www.booking.com/hotel/ar/x');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — platform and source tag
            expect(result.sourcePlatform).toBe('booking');
            expect(result.name?.source).toBe('jsonld');

            // name
            expect(result.name?.value).toBe('Hotel del Rio Booking');

            // description
            expect(result.description?.value).toBe('Un hotel junto al río Paraná.');
            expect(result.description?.source).toBe('jsonld');

            // location
            expect(result.location?.coordinates?.source).toBe('jsonld');
            const coords = result.location?.coordinates?.value as { lat: string; long: string };
            expect(Number(coords.lat)).toBeCloseTo(-32.4825, 4);
            expect(Number(coords.long)).toBeCloseTo(-58.2375, 4);

            // street
            expect(result.location?.street?.value).toBe('Av. Costanera 123');

            // advisory
            expect(result.scrapedLocality).toBe('Concepción del Uruguay');
            expect(result.scrapedCountry).toBe('AR');
            expect(result.imageUrls).toEqual([
                'https://cf.bstatic.com/photo1.jpg',
                'https://cf.bstatic.com/photo2.jpg'
            ]);

            // Apify should NOT have been called
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });

        it('should NOT call runApifyActor when primary yields sufficient fields', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValue(fetchOk(HTML_WITH_JSONLD_HOTEL));
            const ctx = makeCtx();

            // Act
            await adapter.extract(new URL('https://www.booking.com/hotel/ar/x'), ctx);

            // Assert
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // extract() — aggregateRating/review stripped by JSON-LD path
    // -----------------------------------------------------------------------

    describe('extract() — SPEC-222 review/rating stripping in JSON-LD path', () => {
        it('should not include aggregateRating or review fields from JSON-LD even when present in HTML', async () => {
            // Arrange — HTML_WITH_JSONLD_HOTEL has aggregateRating + review in the script
            mockSafeExternalFetch.mockResolvedValue(fetchOk(HTML_WITH_JSONLD_HOTEL));

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                makeCtx()
            );

            // Assert
            const serialised = JSON.stringify(result);
            expect(serialised).not.toContain('"aggregateRating"');
            expect(serialised).not.toContain('"ratingValue"');
            expect(serialised).not.toContain('"reviewCount"');
            expect(serialised).not.toContain('"review"');

            expect(result).not.toHaveProperty('aggregateRating');
            expect(result).not.toHaveProperty('review');
            expect(result).not.toHaveProperty('ratingValue');
            expect(result).not.toHaveProperty('reviewCount');
        });
    });

    // -----------------------------------------------------------------------
    // extract() — blocked primary + Apify creds present
    // -----------------------------------------------------------------------

    describe('extract() — blocked fetch with Apify fallback', () => {
        it('should call runApifyActor when primary fetch is blocked and creds are present', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue([BOOKING_APIFY_ITEM_FULL]);
            const ctx = makeCtx();
            const url = new URL('https://www.booking.com/hotel/ar/x');

            // Act
            const result = await adapter.extract(url, ctx);

            // Assert — Apify was called
            expect(mockRunApifyActor).toHaveBeenCalledOnce();
            expect(mockRunApifyActor).toHaveBeenCalledWith(
                expect.objectContaining({
                    token: 'test-apify-token',
                    actor: 'voyager/booking-scraper',
                    actorInput: { startUrls: [{ url: url.href }] }
                })
            );

            // Result tagged official_api
            expect(result.sourcePlatform).toBe('booking');
            expect(result.name?.source).toBe('official_api');
            expect(result.name?.value).toBe('Alojamiento Booking Apify');
            expect(result.description?.source).toBe('official_api');
        });

        it('should map Apify dataset item fields correctly', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue([BOOKING_APIFY_ITEM_FULL]);

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                makeCtx()
            );

            // Assert mapped fields
            expect(result.description?.value).toBe('Alojamiento con pileta y jardín.');

            const coords = result.location?.coordinates?.value as { lat: string; long: string };
            expect(Number(coords.lat)).toBeCloseTo(-32.4825, 4);
            expect(Number(coords.long)).toBeCloseTo(-58.2375, 4);

            expect(result.scrapedLocality).toBe('Concepción del Uruguay');
            expect(result.scrapedCountry).toBe('Argentina');

            expect(result.imageUrls).toEqual([
                'https://cf.bstatic.com/apify-photo1.jpg',
                'https://cf.bstatic.com/apify-photo2.jpg'
            ]);

            expect(result.extraInfo?.capacity).toEqual({ value: 4, source: 'official_api' });
            expect(result.extraInfo?.bedrooms).toEqual({ value: 2, source: 'official_api' });
            expect(result.extraInfo?.bathrooms).toEqual({ value: 1, source: 'official_api' });
        });

        it('should strip rating/review fields from Apify dataset item', async () => {
            // Arrange — BOOKING_APIFY_ITEM_FULL has rating, reviews, etc.
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue([BOOKING_APIFY_ITEM_FULL]);

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                makeCtx()
            );

            // Assert — forbidden keys absent
            const serialised = JSON.stringify(result);
            expect(serialised).not.toContain('"rating"');
            expect(serialised).not.toContain('"reviewsCount"');
            expect(serialised).not.toContain('"guestRating"');
            expect(serialised).not.toContain('"reviewScore"');
            expect(serialised).not.toContain('"starRating"');
            expect(serialised).not.toContain('"reviews"');
            expect(serialised).not.toContain('"ratingBreakdown"');

            expect(result).not.toHaveProperty('rating');
            expect(result).not.toHaveProperty('reviewsCount');
            expect(result).not.toHaveProperty('guestRating');
            expect(result).not.toHaveProperty('reviews');
        });
    });

    // -----------------------------------------------------------------------
    // extract() — blocked primary + Apify creds absent
    // -----------------------------------------------------------------------

    describe('extract() — blocked fetch with Apify creds absent', () => {
        it('should return degraded result when fetch is blocked and apifyToken is absent', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            const ctx = makeCtx({ apifyToken: undefined });

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                ctx
            );

            // Assert
            expect(result).toEqual({ sourcePlatform: 'booking' });
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });

        it('should return degraded result when fetch is blocked and apifyBookingActor is absent', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            const ctx = makeCtx({ apifyBookingActor: undefined });

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                ctx
            );

            // Assert
            expect(result).toEqual({ sourcePlatform: 'booking' });
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });

        it('should not throw when fetch is blocked and both Apify creds are absent', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            const ctx = makeCtx({ apifyToken: undefined, apifyBookingActor: undefined });

            // Act + Assert — must not throw
            await expect(
                adapter.extract(new URL('https://www.booking.com/hotel/ar/x'), ctx)
            ).resolves.toEqual({ sourcePlatform: 'booking' });
        });
    });

    // -----------------------------------------------------------------------
    // extract() — threshold: sparse JSON-LD triggers fallback
    // -----------------------------------------------------------------------

    describe('extract() — sparse JSON-LD triggers Apify fallback', () => {
        it('should call runApifyActor when JSON-LD yields only 1 useful field (< threshold)', async () => {
            // Arrange — HTML_WITH_SPARSE_JSONLD has only "name" → 1 useful field
            mockSafeExternalFetch.mockResolvedValue(fetchOk(HTML_WITH_SPARSE_JSONLD));
            mockRunApifyActor.mockResolvedValue([{ name: 'Hotel Fallback', description: 'Desc' }]);
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                ctx
            );

            // Assert — fallback was triggered
            expect(mockRunApifyActor).toHaveBeenCalledOnce();
            expect(result.name?.source).toBe('official_api');
            expect(result.name?.value).toBe('Hotel Fallback');
        });
    });

    // -----------------------------------------------------------------------
    // extract() — everything fails → degraded, no throw
    // -----------------------------------------------------------------------

    describe('extract() — total failure degrades gracefully', () => {
        it('should return degraded result when fetch is blocked and Apify returns empty array', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue([]);
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                ctx
            );

            // Assert
            expect(result).toEqual({ sourcePlatform: 'booking' });
        });

        it('should not throw when safeExternalFetch itself rejects unexpectedly', async () => {
            // Arrange — simulate an internal exception (not a normal blocked result)
            mockSafeExternalFetch.mockRejectedValue(new Error('Unexpected network failure'));
            const ctx = makeCtx();

            // Act + Assert
            await expect(
                adapter.extract(new URL('https://www.booking.com/hotel/ar/x'), ctx)
            ).resolves.toEqual({ sourcePlatform: 'booking' });
        });

        it('should not throw when runApifyActor itself rejects unexpectedly', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockRejectedValue(new Error('Apify network failure'));
            const ctx = makeCtx();

            // Act + Assert
            await expect(
                adapter.extract(new URL('https://www.booking.com/hotel/ar/x'), ctx)
            ).resolves.toEqual({ sourcePlatform: 'booking' });
        });
    });
});

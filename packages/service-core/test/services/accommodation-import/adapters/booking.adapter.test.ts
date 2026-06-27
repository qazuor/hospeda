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
 * - SPEC-258 A4 (voyager/booking-scraper real shape):
 *   - `type: "hotel"` → `result.type` from Apify path.
 *   - `facilities[].facilities[].name` → `result.amenityNames` (flattened, deduped).
 *   - `address: { city, country }` object → `scrapedLocality` / `scrapedCountry`.
 *   - `location: { lat, lng }` coordinate strings → `result.location.coordinates`.
 * - SPEC-258 A4a: JSON-LD `lodgingType` (schema.org @type) → `result.type`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImportContext } from '../../../../src/services/accommodation-import/adapter.types.js';
import { BookingAdapter } from '../../../../src/services/accommodation-import/adapters/booking.adapter.js';

// ---------------------------------------------------------------------------
// Mock safeExternalFetch from @repo/utils/safe-fetch
// ---------------------------------------------------------------------------

vi.mock('@repo/utils/safe-fetch', () => ({
    safeExternalFetch: vi.fn()
}));

import { safeExternalFetch } from '@repo/utils/safe-fetch';

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

/**
 * A trimmed-but-faithful copy of the live `voyager/booking-scraper` probe
 * for "Posta Torreón" (SPEC-258 probe-booking-raw.json).
 *
 * Key real-shape details:
 * - `type: "hotel"` (NOT `propertyType`)
 * - `address: { full, country, city }` object (NOT a string)
 * - `location: { lat, lng }` as coordinate strings
 * - `facilities: [{ name, facilities: [{ name, additionalInfo }] }]`
 * - `images`: plain string array
 * - `price: null`, `rooms: []` (no check-in/out dates given)
 */
const BOOKING_REAL_PROBE_ITEM: Record<string, unknown> = {
    name: 'Posta Torreón',
    type: 'hotel',
    description:
        'About this propertyComfortable Accommodations: Posta Torreón in Concepción del Uruguay offers spacious rooms with private bathrooms, air-conditioning, and free WiFi.',
    location: { lat: '-32.487803', lng: '-58.233167' },
    address: {
        full: '799 Almafuerte 799, 3260 Concepción del Uruguay, Argentina',
        country: 'ar',
        city: 'Concepción del Uruguay'
    },
    price: null,
    currency: null,
    rooms: [],
    images: [
        'https://cf.bstatic.com/xdata/images/hotel/max1024x768/286073067.jpg',
        'https://cf.bstatic.com/xdata/images/hotel/max1024x768/315726179.jpg'
    ],
    facilities: [
        {
            name: 'Great for your stay',
            facilities: [
                {
                    name: 'Free WiFi',
                    additionalInfo: { requiresAdditionalCharge: false, isOffSite: false }
                },
                {
                    name: 'Non-smoking rooms',
                    additionalInfo: { requiresAdditionalCharge: false, isOffSite: false },
                    id: 16
                },
                {
                    name: 'Flat-screen TV',
                    additionalInfo: { requiresAdditionalCharge: false, isOffSite: false },
                    id: 75
                },
                {
                    name: 'Bar',
                    additionalInfo: { requiresAdditionalCharge: false, isOffSite: false }
                }
            ],
            overview: null,
            id: null
        },
        {
            name: 'Outdoors',
            id: 13,
            facilities: [
                {
                    name: 'Outdoor furniture',
                    additionalInfo: { requiresAdditionalCharge: false, isOffSite: false },
                    id: 222
                }
            ]
        },
        {
            name: 'Parking',
            id: 16,
            overview: 'No parking available.',
            facilities: []
        },
        {
            name: 'General',
            id: 1,
            facilities: [
                {
                    name: 'Air conditioning',
                    additionalInfo: { requiresAdditionalCharge: false, isOffSite: false },
                    id: 109
                },
                {
                    name: 'Non-smoking rooms',
                    additionalInfo: { requiresAdditionalCharge: false, isOffSite: false },
                    id: 16
                }
            ]
        }
    ]
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

        // Security: booking.com.attacker.com contains the string "booking.com"
        // but must NOT be treated as a Booking.com URL (CodeQL URL-substring fix).
        it('should return false for booking.com.attacker.com (hostile subdomain)', () => {
            expect(adapter.supports(new URL('https://booking.com.attacker.com/steal'))).toBe(false);
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
            mockRunApifyActor.mockResolvedValue({ items: [BOOKING_APIFY_ITEM_FULL] });
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
                    // Price probe params are included in actorInput (SPEC-258).
                    actorInput: expect.objectContaining({
                        startUrls: [{ url: url.href }],
                        checkIn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
                        checkOut: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
                        adults: 2,
                        currency: 'USD'
                    })
                })
            );

            // Result tagged official_api
            expect(result.sourcePlatform).toBe('booking');
            expect(result.name?.source).toBe('official_api');
            expect(result.name?.value).toBe('Alojamiento Booking Apify');
            expect(result.description?.source).toBe('official_api');
        });

        it('passes apifyTimeoutMs to the Apify fallback, not the short fetch timeout', async () => {
            // Arrange — fetch timeout short (8s), Apify budget long (120s)
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue({ items: [BOOKING_APIFY_ITEM_FULL] });
            const ctx: ImportContext = { ...makeCtx(), timeoutMs: 8_000, apifyTimeoutMs: 120_000 };

            // Act
            await adapter.extract(new URL('https://www.booking.com/hotel/ar/x'), ctx);

            // Assert — the actor run gets the long Apify budget, not the 8s fetch timeout
            expect(mockRunApifyActor).toHaveBeenCalledWith(
                expect.objectContaining({ timeoutMs: 120_000 })
            );
        });

        it('should map Apify dataset item fields correctly', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue({ items: [BOOKING_APIFY_ITEM_FULL] });

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
            mockRunApifyActor.mockResolvedValue({ items: [BOOKING_APIFY_ITEM_FULL] });

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
            expect(result).toEqual({
                sourcePlatform: 'booking',
                failureCode: 'credentials_missing'
            });
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
            expect(result).toEqual({
                sourcePlatform: 'booking',
                failureCode: 'credentials_missing'
            });
            expect(mockRunApifyActor).not.toHaveBeenCalled();
        });

        it('should not throw when fetch is blocked and both Apify creds are absent', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            const ctx = makeCtx({ apifyToken: undefined, apifyBookingActor: undefined });

            // Act + Assert — must not throw
            await expect(
                adapter.extract(new URL('https://www.booking.com/hotel/ar/x'), ctx)
            ).resolves.toEqual({ sourcePlatform: 'booking', failureCode: 'credentials_missing' });
        });
    });

    // -----------------------------------------------------------------------
    // extract() — threshold: sparse JSON-LD triggers fallback
    // -----------------------------------------------------------------------

    describe('extract() — sparse JSON-LD triggers Apify fallback', () => {
        it('should call runApifyActor when JSON-LD yields only 1 useful field (< threshold)', async () => {
            // Arrange — HTML_WITH_SPARSE_JSONLD has only "name" → 1 useful field
            mockSafeExternalFetch.mockResolvedValue(fetchOk(HTML_WITH_SPARSE_JSONLD));
            mockRunApifyActor.mockResolvedValue({
                items: [{ name: 'Hotel Fallback', description: 'Desc' }]
            });
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
            mockRunApifyActor.mockResolvedValue({ items: [] });
            const ctx = makeCtx();

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                ctx
            );

            // Assert
            expect(result).toEqual({ sourcePlatform: 'booking', failureCode: 'source_blocked' });
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

    // -----------------------------------------------------------------------
    // SPEC-258 A4: voyager/booking-scraper real shape
    // -----------------------------------------------------------------------

    describe('SPEC-258 A4 — voyager/booking-scraper real probe shape', () => {
        it('should map type from top-level `type` field (not propertyType)', async () => {
            // Arrange — real probe: `type: "hotel"` (no propertyType key)
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue({ items: [BOOKING_REAL_PROBE_ITEM] });

            // Act
            const result = await adapter.extract(
                new URL(
                    'https://www.booking.com/hotel/ar/boutique-antigua-posta-del-torreon.en-gb.html'
                ),
                makeCtx()
            );

            // Assert
            expect(result.type).toEqual({ value: 'hotel', source: 'official_api' });
        });

        it('should extract scrapedLocality from nested address.city object', async () => {
            // Arrange — real probe: `address: { full, country: "ar", city: "..." }`
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue({ items: [BOOKING_REAL_PROBE_ITEM] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                makeCtx()
            );

            // Assert
            expect(result.scrapedLocality).toBe('Concepción del Uruguay');
        });

        it('should extract scrapedCountry from nested address.country object', async () => {
            // Arrange — real probe: `address.country: "ar"`
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue({ items: [BOOKING_REAL_PROBE_ITEM] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                makeCtx()
            );

            // Assert
            expect(result.scrapedCountry).toBe('ar');
        });

        it('should extract coordinates from nested location.lat/lng strings', async () => {
            // Arrange — real probe: `location: { lat: "-32.487803", lng: "-58.233167" }`
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue({ items: [BOOKING_REAL_PROBE_ITEM] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                makeCtx()
            );

            // Assert
            expect(result.location?.coordinates?.source).toBe('official_api');
            const coords = result.location?.coordinates?.value as { lat: string; long: string };
            expect(Number(coords.lat)).toBeCloseTo(-32.487803, 5);
            expect(Number(coords.long)).toBeCloseTo(-58.233167, 5);
        });

        it('should flatten facilities groups into amenityNames and deduplicate', async () => {
            // Arrange — real probe has "Non-smoking rooms" and "Flat-screen TV"
            // duplicated across "Great for your stay" and "General" / "Media & Technology"
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue({ items: [BOOKING_REAL_PROBE_ITEM] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                makeCtx()
            );

            // Assert — amenities from all groups are present, duplicates removed
            expect(result.amenityNames).toBeDefined();
            expect(result.amenityNames).toContain('Free WiFi');
            expect(result.amenityNames).toContain('Bar');
            expect(result.amenityNames).toContain('Outdoor furniture');
            expect(result.amenityNames).toContain('Air conditioning');
            // "Non-smoking rooms" appears in two groups — should appear only once
            const nonSmokingCount =
                result.amenityNames?.filter((n) => n === 'Non-smoking rooms').length ?? 0;
            expect(nonSmokingCount).toBe(1);
            // Empty facilities group (Parking has no facilities) should not add anything
            expect(result.amenityNames).not.toContain('Parking');
            expect(result.amenityNames).not.toContain('No parking available.');
        });

        it('should map images from plain string array', async () => {
            // Arrange — real probe: `images: ["https://...", "https://..."]`
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue({ items: [BOOKING_REAL_PROBE_ITEM] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                makeCtx()
            );

            // Assert
            expect(result.imageUrls).toEqual([
                'https://cf.bstatic.com/xdata/images/hotel/max1024x768/286073067.jpg',
                'https://cf.bstatic.com/xdata/images/hotel/max1024x768/315726179.jpg'
            ]);
        });

        it('should return empty amenityNames when all facility groups have empty arrays', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue({
                items: [
                    {
                        name: 'Hotel Empty',
                        type: 'hotel',
                        facilities: [{ name: 'Parking', facilities: [], overview: 'No parking.' }]
                    }
                ]
            });

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                makeCtx()
            );

            // Assert — no amenityNames emitted
            expect(result.amenityNames).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // SPEC-258 A4a: JSON-LD lodgingType → result.type
    // -----------------------------------------------------------------------

    describe('SPEC-258 A4a — JSON-LD lodgingType forwarded as type', () => {
        it('should map lodgingType from JSON-LD @type to result.type with jsonld source', async () => {
            // Arrange — HTML_WITH_JSONLD_HOTEL has @type "Hotel"
            mockSafeExternalFetch.mockResolvedValue(fetchOk(HTML_WITH_JSONLD_HOTEL));

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                makeCtx()
            );

            // Assert — type forwarded from JSON-LD @type
            expect(result.type).toEqual({ value: 'Hotel', source: 'jsonld' });
        });

        it('should not set type when JSON-LD has no @type in lodging set', async () => {
            // Arrange — HTML with a JSON-LD block whose @type is NOT a lodging type.
            const htmlNonLodging = `<!DOCTYPE html><html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "WebSite", "name": "Booking" }
</script></head><body></body></html>`;
            mockSafeExternalFetch.mockResolvedValue(fetchOk(htmlNonLodging));
            mockRunApifyActor.mockResolvedValue({ items: [] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                makeCtx()
            );

            // Assert — no type when JSON-LD had no lodging @type
            expect(result.type).toBeUndefined();
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
         * The Booking adapter only reaches runApifyActor via the Apify fallback
         * path.  To reliably drive that path we mock the primary fetch as blocked
         * (fetchBlocked()) so the adapter always skips JSON-LD and calls withRetry.
         *
         * Pattern used per test:
         *   vi.useFakeTimers();
         *   const p = adapter.extract(url, ctx);
         *   await vi.runAllTimersAsync();   // drains the sleep() inside withRetry
         *   const result = await p;
         *   vi.useRealTimers();
         */

        const url = new URL('https://www.booking.com/hotel/ar/x');

        it('should succeed on the 3rd attempt after two source_blocked results', async () => {
            // Arrange — primary fetch is blocked so the actor path is always taken.
            // First two actor calls return source_blocked (retryable); third succeeds.
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor
                .mockResolvedValueOnce({ items: [], failureCode: 'source_blocked' })
                .mockResolvedValueOnce({ items: [], failureCode: 'source_blocked' })
                .mockResolvedValueOnce({ items: [BOOKING_APIFY_ITEM_FULL] });
            const ctx = makeCtx();

            // Act — start the promise, flush fake timers to skip sleep(), then await
            vi.useFakeTimers();
            const p = adapter.extract(url, ctx);
            await vi.runAllTimersAsync();
            const result = await p;
            vi.useRealTimers();

            // Assert — extraction is successful (no failureCode, name mapped)
            expect(result.sourcePlatform).toBe('booking');
            expect(result.failureCode).toBeUndefined();
            expect(result.name?.value).toBe('Alojamiento Booking Apify');

            // Exactly 3 calls: 1 initial + 2 retries
            expect(mockRunApifyActor).toHaveBeenCalledTimes(3);
        });

        it('should return source_blocked after exhausting all 3 attempts', async () => {
            // Arrange — primary fetch blocked, all three actor calls return source_blocked
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
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
            expect(result).toEqual({ sourcePlatform: 'booking', failureCode: 'source_blocked' });

            // Retry cap enforced: exactly 3 calls (1 + 2 retries = cap)
            expect(mockRunApifyActor).toHaveBeenCalledTimes(3);
        });

        it('should not retry credentials_missing and return immediately after 1 call', async () => {
            // Arrange — primary fetch blocked (so we reach the actor), credentials
            // present in ctx so the adapter does not early-exit before calling withRetry.
            // The actor itself returns credentials_missing (non-retryable) on the first call.
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
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
                sourcePlatform: 'booking',
                failureCode: 'credentials_missing'
            });
            expect(mockRunApifyActor).toHaveBeenCalledTimes(1);
        });
    });

    // -----------------------------------------------------------------------
    // SPEC-258 price probe — Booking per-night price extraction
    // -----------------------------------------------------------------------

    /**
     * A real-probe-shaped item WITH check-in/check-out dates sent.
     * voyager/booking-scraper returns `price` as a TOTAL for the stay.
     * 157.3 total ÷ 2 nights = 78.65 per night.
     */
    const BOOKING_PROBE_WITH_PRICE: Record<string, unknown> = {
        name: 'Posta Torreón',
        type: 'hotel',
        description: 'Comfortable hotel near the city center.',
        location: { lat: '-32.487803', lng: '-58.233167' },
        address: {
            full: '799 Almafuerte, Concepción del Uruguay',
            country: 'ar',
            city: 'Concepción del Uruguay'
        },
        price: 157.3,
        currency: 'USD',
        images: ['https://cf.bstatic.com/img1.jpg'],
        facilities: []
    };

    describe('SPEC-258 price probe — Booking per-night price from actor total', () => {
        it('should emit per-night price and USD currency when actor returns total price', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue({ items: [BOOKING_PROBE_WITH_PRICE] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                makeCtx()
            );

            // Assert — 157.3 total ÷ 2 nights = 78.65 per night.
            // Tagged 'text' (50% confidence) — date-specific estimate, not authoritative.
            expect(result.price?.price).toEqual({ value: 78.65, source: 'text' });
            expect(result.price?.currency).toEqual({ value: 'USD', source: 'text' });
        });

        it('should not emit price when actor returns null price (no dates sent)', async () => {
            // Arrange — BOOKING_REAL_PROBE_ITEM has `price: null`
            mockSafeExternalFetch.mockResolvedValue(fetchBlocked());
            mockRunApifyActor.mockResolvedValue({ items: [BOOKING_REAL_PROBE_ITEM] });

            // Act
            const result = await adapter.extract(
                new URL('https://www.booking.com/hotel/ar/x'),
                makeCtx()
            );

            // Assert — no price candidate emitted
            expect(result.price).toBeUndefined();
        });
    });
});

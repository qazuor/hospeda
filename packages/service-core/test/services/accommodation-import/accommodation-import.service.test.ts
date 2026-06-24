/**
 * Unit tests for AccommodationImportService (SPEC-222 T-019)
 *
 * AAA pattern throughout. All adapters and resolver modules are mocked so no
 * real network I/O or DB access is performed.
 *
 * Covers:
 * - Happy path: adapter returns a rich RawExtraction → draft populated, source
 *   labelled, methodsUsed present, partial true (no destination FK set).
 * - adapter.extract throws → degraded response, no throw.
 * - Empty extraction (adapter returns bare { sourcePlatform }) → source 'none',
 *   message set, draft {}, partial true.
 * - Invalid URL string → degraded { source: 'none' }, no throw.
 * - resolveAmenities throws → response still returned, amenities omitted.
 * - mediaHints present when raw.imageUrls is non-empty; absent when empty.
 * - destinationHint propagated from buildDestinationHint (non-empty candidates).
 * - destinationHint omitted when locality absent (no candidates, no locality).
 * - Reviews/ratings never appear in the response.
 * - destinationId / FK never set in the response.
 * - resolvedAmenityIds and unresolvedAmenities only present when non-empty.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
    ImportContext,
    RawExtraction
} from '../../../src/services/accommodation-import/adapter.types.js';
import type { Actor, ServiceConfig } from '../../../src/types/index.js';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any dynamic imports.
// ---------------------------------------------------------------------------

// Mock the adapter modules so we control extract() output.
vi.mock('../../../src/services/accommodation-import/adapters/generic.adapter.js', () => ({
    GenericAdapter: vi.fn()
}));
vi.mock('../../../src/services/accommodation-import/adapters/airbnb.adapter.js', () => ({
    AirbnbAdapter: vi.fn()
}));
vi.mock('../../../src/services/accommodation-import/adapters/booking.adapter.js', () => ({
    BookingAdapter: vi.fn()
}));
vi.mock('../../../src/services/accommodation-import/adapters/google-places.adapter.js', () => ({
    GooglePlacesAdapter: vi.fn()
}));
vi.mock('../../../src/services/accommodation-import/adapters/mercadolibre.adapter.js', () => ({
    MercadoLibreAdapter: vi.fn()
}));

// Mock the resolver modules.
vi.mock('../../../src/services/accommodation-import/resolvers/amenities.js', () => ({
    resolveAmenities: vi.fn()
}));
vi.mock('../../../src/services/accommodation-import/resolvers/destination.js', () => ({
    buildDestinationHint: vi.fn()
}));

// Mock AmenityService and DestinationService so construction succeeds with
// a fake ctx that has no real DB connection.
vi.mock('../../../src/services/amenity/amenity.service.js', () => ({
    AmenityService: vi.fn()
}));
vi.mock('../../../src/services/destination/destination.service.js', () => ({
    DestinationService: vi.fn()
}));

import { AccommodationImportService } from '../../../src/services/accommodation-import/accommodation-import.service.js';
import { AirbnbAdapter } from '../../../src/services/accommodation-import/adapters/airbnb.adapter.js';
import { BookingAdapter } from '../../../src/services/accommodation-import/adapters/booking.adapter.js';
// Import after vi.mock so we get the mocked versions.
import { GenericAdapter } from '../../../src/services/accommodation-import/adapters/generic.adapter.js';
import { GooglePlacesAdapter } from '../../../src/services/accommodation-import/adapters/google-places.adapter.js';
import { MercadoLibreAdapter } from '../../../src/services/accommodation-import/adapters/mercadolibre.adapter.js';
import { resolveAmenities } from '../../../src/services/accommodation-import/resolvers/amenities.js';
import { buildDestinationHint } from '../../../src/services/accommodation-import/resolvers/destination.js';

// Typed mock helpers.
const mockGenericAdapter = vi.mocked(GenericAdapter);
const mockAirbnbAdapter = vi.mocked(AirbnbAdapter);
const mockBookingAdapter = vi.mocked(BookingAdapter);
const mockGoogleAdapter = vi.mocked(GooglePlacesAdapter);
const mockMlAdapter = vi.mocked(MercadoLibreAdapter);
const mockResolveAmenities = vi.mocked(resolveAmenities);
const mockBuildDestinationHint = vi.mocked(buildDestinationHint);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal ServiceConfig for constructing the service. */
const fakeCtx: ServiceConfig = {};

/** Minimal Actor. */
const fakeActor: Actor = {
    id: '00000000-0000-0000-0000-000000000001',
    role: 'HOST',
    permissions: []
} as unknown as Actor;

// Valid UUIDs for test data (must pass z.string().uuid() validation in the schema).
// These use the v4 UUID format (version nibble = 4, variant nibble = 8-b).
const UUID_AMENITY_WIFI = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const UUID_DEST_001 = 'b1c2d3e4-f5a6-4b7c-8d9e-f0a1b2c3d4e5';
const UUID_DEST_002 = 'c1d2e3f4-a5b6-4c7d-8e9f-a0b1c2d3e4f5';

/** Default ImportContext with no credentials. */
const fakeContext: ImportContext = {
    locale: 'es',
    timeoutMs: 10_000,
    maxBytes: 5_000_000,
    aiMaxChars: 4_000,
    credentials: {}
};

/**
 * Builds a fake adapter instance (object, not class instance).
 * By default, `supports` returns false; pass `supportsResult: true` to make it
 * match any URL. The `extract` implementation is fully controllable.
 */
function makeFakeAdapter(
    source: string,
    supportsResult: boolean,
    extractImpl?: () => Promise<RawExtraction>
) {
    return {
        source,
        supports: vi.fn().mockReturnValue(supportsResult),
        extract: extractImpl ? vi.fn().mockImplementation(extractImpl) : vi.fn()
    };
}

// ---------------------------------------------------------------------------
// Before each: set up the adapter constructors to return controllable fakes.
// By default all non-generic adapters do NOT support the URL (supportsResult=false).
// GenericAdapter always supports HTTPS (supportsResult=true).
// ---------------------------------------------------------------------------

let fakeGeneric: ReturnType<typeof makeFakeAdapter>;
let fakeAirbnb: ReturnType<typeof makeFakeAdapter>;
let fakeBooking: ReturnType<typeof makeFakeAdapter>;
let fakeGoogle: ReturnType<typeof makeFakeAdapter>;
let fakeMl: ReturnType<typeof makeFakeAdapter>;

beforeEach(() => {
    vi.clearAllMocks();

    // Default resolver stubs — return empty/safe values.
    mockResolveAmenities.mockResolvedValue({ amenityIds: [], unresolved: [] });
    mockBuildDestinationHint.mockResolvedValue({ candidates: [] });

    // Build fresh fake adapter instances.
    fakeGeneric = makeFakeAdapter('generic', true);
    fakeAirbnb = makeFakeAdapter('airbnb', false);
    fakeBooking = makeFakeAdapter('booking', false);
    fakeGoogle = makeFakeAdapter('google', false);
    fakeMl = makeFakeAdapter('mercadolibre', false);

    // Wire constructors so `new XxxAdapter()` returns our fake.
    mockGenericAdapter.mockImplementation(
        () => fakeGeneric as unknown as InstanceType<typeof GenericAdapter>
    );
    mockAirbnbAdapter.mockImplementation(
        () => fakeAirbnb as unknown as InstanceType<typeof AirbnbAdapter>
    );
    mockBookingAdapter.mockImplementation(
        () => fakeBooking as unknown as InstanceType<typeof BookingAdapter>
    );
    mockGoogleAdapter.mockImplementation(
        () => fakeGoogle as unknown as InstanceType<typeof GooglePlacesAdapter>
    );
    mockMlAdapter.mockImplementation(
        () => fakeMl as unknown as InstanceType<typeof MercadoLibreAdapter>
    );
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccommodationImportService', () => {
    // -------------------------------------------------------------------------
    // Happy path — rich extraction
    // -------------------------------------------------------------------------
    describe('when the adapter returns a rich RawExtraction', () => {
        it('should return a populated draft with source, methodsUsed, partial true, and mediaHints', async () => {
            // Arrange
            const richRaw: RawExtraction = {
                sourcePlatform: 'generic',
                name: { value: 'Cabaña del Río', source: 'jsonld' },
                summary: { value: 'A cozy cabin by the river.', source: 'opengraph' },
                // Note: no `type` field → partial=true
                imageUrls: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
                amenityNames: ['WiFi', 'Pileta'],
                scrapedLocality: 'Concepción del Uruguay'
            };
            fakeGeneric.extract.mockResolvedValue(richRaw);
            mockResolveAmenities.mockResolvedValue({
                amenityIds: [UUID_AMENITY_WIFI],
                unresolved: ['Pileta']
            });
            mockBuildDestinationHint.mockResolvedValue({
                scrapedLocality: 'Concepción del Uruguay',
                candidates: [{ id: UUID_DEST_001, name: 'Concepción del Uruguay' }]
            });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/42', context: fakeContext },
                fakeActor
            );

            // Assert — draft has name and summary (both present in raw)
            expect(result.draft).toMatchObject({
                name: expect.objectContaining({ value: 'Cabaña del Río' }),
                summary: expect.objectContaining({ value: 'A cozy cabin by the river.' })
            });

            // source comes from detectSource (URL is generic)
            expect(result.source).toBe('generic');

            // methodsUsed reflects the sources used (jsonld + opengraph)
            expect(result.methodsUsed).toContain('jsonld');
            expect(result.methodsUsed).toContain('opengraph');

            // partial: true because `type` is absent
            expect(result.partial).toBe(true);

            // mediaHints populated
            expect(result.mediaHints).toEqual({
                imageUrls: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg']
            });

            // resolvedAmenityIds present (non-empty)
            expect(result.resolvedAmenityIds).toEqual([UUID_AMENITY_WIFI]);

            // unresolvedAmenities present (non-empty)
            expect(result.unresolvedAmenities).toEqual(['Pileta']);

            // destinationHint propagated
            expect(result.destinationHint).toMatchObject({
                scrapedLocality: 'Concepción del Uruguay',
                candidates: [{ id: UUID_DEST_001, name: 'Concepción del Uruguay' }]
            });
        });

        it('should set partial=false when name, summary, AND type are all present', async () => {
            // Arrange
            const completeRaw: RawExtraction = {
                sourcePlatform: 'generic',
                name: { value: 'Hotel Sol', source: 'jsonld' },
                summary: { value: 'A sunny hotel.', source: 'jsonld' },
                type: { value: 'HOTEL', source: 'jsonld' }
            };
            fakeGeneric.extract.mockResolvedValue(completeRaw);

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/hotel', context: fakeContext },
                fakeActor
            );

            // Assert — all three mandatory fields present → partial false.
            // Note: destination FK is still never set, but partial is computed
            // from name+summary+type alone (per spec §T-019 formula).
            expect(result.partial).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // Adapter routing
    // -------------------------------------------------------------------------
    describe('adapter routing', () => {
        it('should use the first adapter whose supports() returns true', async () => {
            // Arrange — make the booking adapter match
            fakeBooking.supports.mockReturnValue(true);
            fakeBooking.extract.mockResolvedValue({ sourcePlatform: 'booking' });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            await service.importFromUrl(
                { url: 'https://www.booking.com/hotel/ar/sol.html', context: fakeContext },
                fakeActor
            );

            // Assert — booking adapter's extract was called, generic was not
            expect(fakeBooking.extract).toHaveBeenCalledOnce();
            expect(fakeGeneric.extract).not.toHaveBeenCalled();
        });

        it('should fall back to GenericAdapter when no specific adapter supports the URL', async () => {
            // Arrange — all specific adapters return false (already the default)
            fakeGeneric.extract.mockResolvedValue({ sourcePlatform: 'generic' });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            await service.importFromUrl(
                { url: 'https://some-unknown-site.com/listing/99', context: fakeContext },
                fakeActor
            );

            // Assert — only GenericAdapter.extract was called
            expect(fakeGeneric.extract).toHaveBeenCalledOnce();
            expect(fakeAirbnb.extract).not.toHaveBeenCalled();
            expect(fakeBooking.extract).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // adapter.extract throws
    // -------------------------------------------------------------------------
    describe('when adapter.extract throws', () => {
        it('should return a degraded response and never rethrow', async () => {
            // Arrange
            fakeGeneric.extract.mockRejectedValue(new Error('Network timeout'));

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/1', context: fakeContext },
                fakeActor
            );

            // Assert — degrades gracefully
            expect(result.partial).toBe(true);
            expect(result.draft).toEqual({});
            expect(result.source).toBe('none');
            expect(result.methodsUsed).toEqual([]);
            expect(result.failureCode).toBe('provider_error');
            // No throw — the promise resolves
        });

        it('should still resolve the promise (no throw)', async () => {
            // Arrange
            fakeGeneric.extract.mockRejectedValue(new Error('Adapter exploded'));

            const service = new AccommodationImportService(fakeCtx);

            // Act + Assert — await does not throw
            await expect(
                service.importFromUrl(
                    { url: 'https://example.com/listing/2', context: fakeContext },
                    fakeActor
                )
            ).resolves.toBeDefined();
        });
    });

    // -------------------------------------------------------------------------
    // failureCode propagation from adapter
    // -------------------------------------------------------------------------
    describe('when adapter returns a RawExtraction with failureCode', () => {
        it('should propagate failureCode: credentials_missing from the adapter', async () => {
            // Arrange — adapter degraded with a specific code (e.g. missing API key)
            fakeGeneric.extract.mockResolvedValue({
                sourcePlatform: 'generic',
                failureCode: 'credentials_missing'
            } as RawExtraction);

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/failcode', context: fakeContext },
                fakeActor
            );

            // Assert — failureCode propagated from adapter; message absent
            expect(result.failureCode).toBe('credentials_missing');
            expect(result.message).toBeUndefined();
            expect(result.source).toBe('none');
            expect(result.draft).toEqual({});
        });

        it('should propagate failureCode: source_blocked from the adapter', async () => {
            // Arrange
            fakeAirbnb.supports.mockReturnValue(true);
            fakeAirbnb.extract.mockResolvedValue({
                sourcePlatform: 'airbnb',
                failureCode: 'source_blocked'
            } as RawExtraction);

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                {
                    url: 'https://www.airbnb.com/rooms/12345',
                    context: fakeContext
                },
                fakeActor
            );

            // Assert
            expect(result.failureCode).toBe('source_blocked');
            expect(result.message).toBeUndefined();
        });

        it('should NOT override adapter failureCode with nothing_found when draft is empty', async () => {
            // Arrange — adapter returned source_blocked; draft is empty
            fakeGeneric.extract.mockResolvedValue({
                sourcePlatform: 'generic',
                failureCode: 'timeout'
            } as RawExtraction);

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/timeout-test', context: fakeContext },
                fakeActor
            );

            // Assert — adapter code takes precedence; nothing_found must NOT overwrite it
            expect(result.failureCode).toBe('timeout');
        });
    });

    // -------------------------------------------------------------------------
    // Empty extraction
    // -------------------------------------------------------------------------
    describe('when adapter returns an empty extraction (only sourcePlatform set)', () => {
        it('should return source "none", set a message, empty draft, and partial true', async () => {
            // Arrange — adapter returns the minimal stub (nothing extracted)
            fakeGeneric.extract.mockResolvedValue({ sourcePlatform: 'generic' });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/3', context: fakeContext },
                fakeActor
            );

            // Assert
            expect(result.source).toBe('none');
            expect(result.failureCode).toBe('nothing_found');
            expect(result.message).toBeUndefined();
            expect(result.draft).toEqual({});
            expect(result.partial).toBe(true);
            expect(result.methodsUsed).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    // Invalid URL
    // -------------------------------------------------------------------------
    describe('when the URL string is invalid', () => {
        it('should return a degraded response with source "none" and never throw', async () => {
            // Arrange
            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'not-a-url-at-all', context: fakeContext },
                fakeActor
            );

            // Assert
            expect(result.source).toBe('none');
            expect(result.partial).toBe(true);
            expect(result.draft).toEqual({});
            expect(result.failureCode).toBe('invalid_url');
            expect(result.message).toBeUndefined();
            // No adapter should have been called
            expect(fakeGeneric.extract).not.toHaveBeenCalled();
        });

        it('should resolve the promise (no throw) for a completely malformed string', async () => {
            // Arrange
            const service = new AccommodationImportService(fakeCtx);

            // Act + Assert
            await expect(
                service.importFromUrl(
                    { url: 'ht tp://broken url', context: fakeContext },
                    fakeActor
                )
            ).resolves.toBeDefined();
        });
    });

    // -------------------------------------------------------------------------
    // resolveAmenities throws
    // -------------------------------------------------------------------------
    describe('when resolveAmenities throws', () => {
        it('should still return a valid response with amenity fields omitted', async () => {
            // Arrange
            const rawWithAmenities: RawExtraction = {
                sourcePlatform: 'generic',
                name: { value: 'Some Hotel', source: 'jsonld' },
                amenityNames: ['WiFi', 'Pool']
            };
            fakeGeneric.extract.mockResolvedValue(rawWithAmenities);
            mockResolveAmenities.mockRejectedValue(new Error('Amenity service down'));

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/4', context: fakeContext },
                fakeActor
            );

            // Assert — amenity fields absent, but response is valid
            expect(result.resolvedAmenityIds).toBeUndefined();
            expect(result.unresolvedAmenities).toBeUndefined();
            // name was still extracted
            expect(result.draft).toMatchObject({
                name: expect.objectContaining({ value: 'Some Hotel' })
            });
            // No throw
        });

        it('should never rethrow when resolveAmenities throws', async () => {
            // Arrange
            fakeGeneric.extract.mockResolvedValue({
                sourcePlatform: 'generic',
                amenityNames: ['WiFi']
            });
            mockResolveAmenities.mockRejectedValue(new Error('crash'));

            const service = new AccommodationImportService(fakeCtx);

            // Act + Assert
            await expect(
                service.importFromUrl(
                    { url: 'https://example.com/x', context: fakeContext },
                    fakeActor
                )
            ).resolves.toBeDefined();
        });
    });

    // -------------------------------------------------------------------------
    // No reviews/ratings in response
    // -------------------------------------------------------------------------
    describe('reviews and ratings', () => {
        it('should never include any rating or review key in the assembled response', async () => {
            // Arrange — even if the adapter somehow included something weird
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                name: { value: 'Hotel Sol', source: 'jsonld' }
                // RawExtraction does not have rating/review fields by design.
                // The schema also has no such fields. This test asserts the
                // assembled response shape is clean.
            };
            fakeGeneric.extract.mockResolvedValue(raw);

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/hotel-sol', context: fakeContext },
                fakeActor
            );

            // Assert — none of these keys should exist at any level
            const resultKeys = Object.keys(result);
            expect(resultKeys).not.toContain('rating');
            expect(resultKeys).not.toContain('reviews');
            expect(resultKeys).not.toContain('averageRating');
            expect(resultKeys).not.toContain('reviewCount');

            // Draft keys also clean
            const draftKeys = Object.keys(result.draft);
            expect(draftKeys).not.toContain('rating');
            expect(draftKeys).not.toContain('reviews');
        });
    });

    // -------------------------------------------------------------------------
    // destinationId / FK never set
    // -------------------------------------------------------------------------
    describe('destination FK', () => {
        it('should never set destinationId anywhere in the response', async () => {
            // Arrange
            const raw: RawExtraction = {
                sourcePlatform: 'generic',
                name: { value: 'Hotel Sol', source: 'jsonld' },
                scrapedLocality: 'Concepción del Uruguay'
            };
            fakeGeneric.extract.mockResolvedValue(raw);
            mockBuildDestinationHint.mockResolvedValue({
                scrapedLocality: 'Concepción del Uruguay',
                candidates: [{ id: UUID_DEST_001, name: 'Concepción del Uruguay' }]
            });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/hotel', context: fakeContext },
                fakeActor
            );

            // Assert — the top-level response has no destinationId
            expect(result).not.toHaveProperty('destinationId');
            // The draft also has no destinationId
            expect(result.draft).not.toHaveProperty('destinationId');
            // The destinationHint carries only candidates — no FK
            if (result.destinationHint) {
                expect(result.destinationHint).not.toHaveProperty('destinationId');
            }
        });
    });

    // -------------------------------------------------------------------------
    // mediaHints only present when non-empty
    // -------------------------------------------------------------------------
    describe('mediaHints', () => {
        it('should include mediaHints when imageUrls is non-empty', async () => {
            // Arrange
            fakeGeneric.extract.mockResolvedValue({
                sourcePlatform: 'generic',
                imageUrls: ['https://cdn.example.com/photo1.jpg']
            });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/5', context: fakeContext },
                fakeActor
            );

            // Assert
            expect(result.mediaHints).toBeDefined();
            expect(result.mediaHints?.imageUrls).toEqual(['https://cdn.example.com/photo1.jpg']);
        });

        it('should omit mediaHints when imageUrls is absent', async () => {
            // Arrange — no imageUrls in the extraction
            fakeGeneric.extract.mockResolvedValue({
                sourcePlatform: 'generic',
                name: { value: 'Hotel X', source: 'jsonld' }
            });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/6', context: fakeContext },
                fakeActor
            );

            // Assert
            expect(result.mediaHints).toBeUndefined();
        });

        it('should omit mediaHints when imageUrls is an empty array', async () => {
            // Arrange
            fakeGeneric.extract.mockResolvedValue({
                sourcePlatform: 'generic',
                imageUrls: []
            });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/7', context: fakeContext },
                fakeActor
            );

            // Assert
            expect(result.mediaHints).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // destinationHint conditionally present
    // -------------------------------------------------------------------------
    describe('destinationHint', () => {
        it('should include destinationHint when buildDestinationHint returns candidates', async () => {
            // Arrange
            fakeGeneric.extract.mockResolvedValue({
                sourcePlatform: 'generic',
                scrapedLocality: 'Gualeguaychú'
            });
            mockBuildDestinationHint.mockResolvedValue({
                scrapedLocality: 'Gualeguaychú',
                candidates: [{ id: UUID_DEST_002, name: 'Gualeguaychú' }]
            });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/8', context: fakeContext },
                fakeActor
            );

            // Assert
            expect(result.destinationHint).toBeDefined();
            expect(result.destinationHint?.scrapedLocality).toBe('Gualeguaychú');
            expect(result.destinationHint?.candidates).toHaveLength(1);
            expect(result.destinationHint?.candidates[0]?.id).toBe(UUID_DEST_002);
        });

        it('should omit destinationHint when locality is absent and candidates empty', async () => {
            // Arrange
            fakeGeneric.extract.mockResolvedValue({
                sourcePlatform: 'generic',
                name: { value: 'Hotel Y', source: 'jsonld' }
                // no scrapedLocality
            });
            mockBuildDestinationHint.mockResolvedValue({ candidates: [] });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/9', context: fakeContext },
                fakeActor
            );

            // Assert
            expect(result.destinationHint).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // resolvedAmenityIds and unresolvedAmenities only when non-empty
    // -------------------------------------------------------------------------
    describe('amenity output fields', () => {
        it('should include resolvedAmenityIds only when non-empty', async () => {
            // Arrange
            fakeGeneric.extract.mockResolvedValue({
                sourcePlatform: 'generic',
                amenityNames: ['WiFi']
            });
            mockResolveAmenities.mockResolvedValue({
                amenityIds: [UUID_AMENITY_WIFI],
                unresolved: []
            });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/10', context: fakeContext },
                fakeActor
            );

            // Assert
            expect(result.resolvedAmenityIds).toEqual([UUID_AMENITY_WIFI]);
            expect(result.unresolvedAmenities).toBeUndefined();
        });

        it('should include unresolvedAmenities only when non-empty', async () => {
            // Arrange
            fakeGeneric.extract.mockResolvedValue({
                sourcePlatform: 'generic',
                amenityNames: ['UnknownThing']
            });
            mockResolveAmenities.mockResolvedValue({
                amenityIds: [],
                unresolved: ['UnknownThing']
            });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/11', context: fakeContext },
                fakeActor
            );

            // Assert
            expect(result.resolvedAmenityIds).toBeUndefined();
            expect(result.unresolvedAmenities).toEqual(['UnknownThing']);
        });

        it('should omit both amenity fields when extraction has no amenityNames', async () => {
            // Arrange — no amenityNames in raw → resolveAmenities not called with names
            fakeGeneric.extract.mockResolvedValue({
                sourcePlatform: 'generic',
                name: { value: 'Hotel Z', source: 'jsonld' }
            });
            mockResolveAmenities.mockResolvedValue({ amenityIds: [], unresolved: [] });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/12', context: fakeContext },
                fakeActor
            );

            // Assert
            expect(result.resolvedAmenityIds).toBeUndefined();
            expect(result.unresolvedAmenities).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // buildDestinationHint throws
    // -------------------------------------------------------------------------
    describe('when buildDestinationHint throws', () => {
        it('should still return a valid response with destinationHint omitted', async () => {
            // Arrange
            fakeGeneric.extract.mockResolvedValue({
                sourcePlatform: 'generic',
                scrapedLocality: 'Somewhere'
            });
            mockBuildDestinationHint.mockRejectedValue(new Error('DB unreachable'));

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://example.com/listing/13', context: fakeContext },
                fakeActor
            );

            // Assert — hint omitted, no throw
            expect(result.destinationHint).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // R2 fallback chain (SPEC-277)
    //
    // When the primary Airbnb / Booking adapter returns source_blocked, the
    // orchestrator makes one cheap GenericAdapter (JSON-LD / OpenGraph) pass
    // against the same URL. Other sources and other failureCodes do NOT trigger
    // the fallback.
    // -------------------------------------------------------------------------
    describe('R2 fallback chain', () => {
        /**
         * Builds a minimal RawExtraction that represents a useful OG/JSON-LD
         * fallback with a name field from OpenGraph.
         *
         * @param sourcePlatform - The source label to stamp on the fallback.
         * @returns A RawExtraction with name and summary set via opengraph.
         */
        function buildUsefulFallbackRaw(sourcePlatform: 'airbnb' | 'booking'): RawExtraction {
            return {
                sourcePlatform,
                name: { value: 'Cabaña Vista al Río', source: 'opengraph' },
                summary: { value: 'A riverside cabin with mountain views.', source: 'opengraph' }
            };
        }

        it('should use the generic fallback and return partial=true with source=airbnb when airbnb primary returns source_blocked and fallback has useful data', async () => {
            // Arrange — Airbnb primary returns source_blocked; fallback has name.
            fakeAirbnb.supports.mockReturnValue(true);
            fakeAirbnb.extract.mockResolvedValue({
                sourcePlatform: 'airbnb',
                failureCode: 'source_blocked'
            } as RawExtraction);
            // GenericAdapter is the last entry in the registry and is called by
            // _runFallbackGenericExtract. We configure it to return useful OG data.
            fakeGeneric.extract.mockResolvedValue(buildUsefulFallbackRaw('airbnb'));

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://www.airbnb.com/rooms/99999', context: fakeContext },
                fakeActor
            );

            // Assert — fallback data was used; failureCode cleared; source stays 'airbnb'.
            expect(result.source).toBe('airbnb');
            expect(result.partial).toBe(true); // OG rarely yields name+summary+type
            expect(result.draft).toMatchObject({
                name: expect.objectContaining({ value: 'Cabaña Vista al Río' })
            });
            expect(result.failureCode).toBeUndefined();
        });

        it('should use the generic fallback and return partial=true with source=booking when booking primary returns source_blocked and fallback has useful data', async () => {
            // Arrange — Booking primary returns source_blocked; fallback has name.
            fakeBooking.supports.mockReturnValue(true);
            fakeBooking.extract.mockResolvedValue({
                sourcePlatform: 'booking',
                failureCode: 'source_blocked'
            } as RawExtraction);
            fakeGeneric.extract.mockResolvedValue(buildUsefulFallbackRaw('booking'));

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://www.booking.com/hotel/ar/test.html', context: fakeContext },
                fakeActor
            );

            // Assert — fallback data was used; source stays 'booking'.
            expect(result.source).toBe('booking');
            expect(result.partial).toBe(true);
            expect(result.draft).toMatchObject({
                name: expect.objectContaining({ value: 'Cabaña Vista al Río' })
            });
            expect(result.failureCode).toBeUndefined();
        });

        it('should keep failureCode=source_blocked when airbnb primary is blocked and fallback yields only an empty extraction', async () => {
            // Arrange — Airbnb primary returns source_blocked; fallback returns
            // bare extraction with no useful fields (hasUsefulFallback = false).
            fakeAirbnb.supports.mockReturnValue(true);
            fakeAirbnb.extract.mockResolvedValue({
                sourcePlatform: 'airbnb',
                failureCode: 'source_blocked'
            } as RawExtraction);
            // Fallback returns an extraction with only sourcePlatform — no name,
            // no summary, no imageUrls — so hasUsefulFallback remains false.
            fakeGeneric.extract.mockResolvedValue({
                sourcePlatform: 'airbnb'
            } as RawExtraction);

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://www.airbnb.com/rooms/empty-fallback', context: fakeContext },
                fakeActor
            );

            // Assert — original failure is preserved because fallback was not useful.
            expect(result.failureCode).toBe('source_blocked');
        });

        it('should NOT trigger the fallback when airbnb primary returns credentials_missing', async () => {
            // Arrange — Airbnb primary returns credentials_missing (non-retryable).
            // The R2 fallback only fires on source_blocked, not other failureCodes.
            fakeAirbnb.supports.mockReturnValue(true);
            fakeAirbnb.extract.mockResolvedValue({
                sourcePlatform: 'airbnb',
                failureCode: 'credentials_missing'
            } as RawExtraction);
            // Reset GenericAdapter so a call would be detectable.
            fakeGeneric.extract.mockResolvedValue({ sourcePlatform: 'generic' });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://www.airbnb.com/rooms/no-creds', context: fakeContext },
                fakeActor
            );

            // Assert — failureCode from primary propagated; GenericAdapter NOT called
            // for the fallback (it may have been called 0 times total because the
            // primary adapter matches, so GenericAdapter is not the selected adapter).
            expect(result.failureCode).toBe('credentials_missing');
            // GenericAdapter extract must not have been called at all.
            expect(fakeGeneric.extract).not.toHaveBeenCalled();
        });

        it('should NOT trigger the fallback when google primary returns source_blocked (only airbnb/booking opt in)', async () => {
            // Arrange — GooglePlaces primary returns source_blocked.
            // Only airbnb and booking opt into the R2 fallback chain.
            fakeGoogle.supports.mockReturnValue(true);
            fakeGoogle.extract.mockResolvedValue({
                sourcePlatform: 'google',
                failureCode: 'source_blocked'
            } as RawExtraction);
            fakeGeneric.extract.mockResolvedValue({ sourcePlatform: 'generic' });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: 'https://maps.google.com/maps/place/test-place', context: fakeContext },
                fakeActor
            );

            // Assert — source_blocked propagated; no fallback for google source.
            expect(result.failureCode).toBe('source_blocked');
            // GenericAdapter extract must not have been called at all.
            expect(fakeGeneric.extract).not.toHaveBeenCalled();
        });
    });
});

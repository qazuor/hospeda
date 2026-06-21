/**
 * Unit tests for short-link resolution in AccommodationImportService (SPEC-222)
 *
 * Covers the Step 1b short-link resolution added to fix the bug where Google
 * Maps mobile share links (`maps.app.goo.gl/...`) and Booking.com share stubs
 * (`booking.com/Share-XXX`) returned source:'none' instead of being imported.
 *
 * All network I/O is mocked. Tests verify:
 * - Short-link hosts trigger redirect resolution before adapter selection.
 * - The canonical URL (finalUrl) is passed to adapter.supports() and extract().
 * - Already-canonical URLs are NOT resolved (no extra fetch round-trip).
 * - Resolution failures fall back to the original URL gracefully.
 * - Booking.com /Share-XXX path is treated as a short link.
 * - abnb.me (Airbnb mobile share) is treated as a short link.
 * - After resolution, the correct platform-specific adapter is selected.
 *
 * AAA pattern throughout. All adapters, resolvers, and safeExternalFetch are
 * mocked so no real network I/O or DB access is performed.
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

vi.mock('@repo/utils', () => ({
    safeExternalFetch: vi.fn()
}));

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
vi.mock('../../../src/services/accommodation-import/resolvers/amenities.js', () => ({
    resolveAmenities: vi.fn()
}));
vi.mock('../../../src/services/accommodation-import/resolvers/destination.js', () => ({
    buildDestinationHint: vi.fn()
}));
vi.mock('../../../src/services/amenity/amenity.service.js', () => ({
    AmenityService: vi.fn()
}));
vi.mock('../../../src/services/destination/destination.service.js', () => ({
    DestinationService: vi.fn()
}));

import { safeExternalFetch } from '@repo/utils';
import { AccommodationImportService } from '../../../src/services/accommodation-import/accommodation-import.service.js';
import { AirbnbAdapter } from '../../../src/services/accommodation-import/adapters/airbnb.adapter.js';
import { BookingAdapter } from '../../../src/services/accommodation-import/adapters/booking.adapter.js';
import { GenericAdapter } from '../../../src/services/accommodation-import/adapters/generic.adapter.js';
import { GooglePlacesAdapter } from '../../../src/services/accommodation-import/adapters/google-places.adapter.js';
import { MercadoLibreAdapter } from '../../../src/services/accommodation-import/adapters/mercadolibre.adapter.js';
import { resolveAmenities } from '../../../src/services/accommodation-import/resolvers/amenities.js';
import { buildDestinationHint } from '../../../src/services/accommodation-import/resolvers/destination.js';

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockSafeExternalFetch = vi.mocked(safeExternalFetch);
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

const fakeCtx: ServiceConfig = {};

const fakeActor: Actor = {
    id: '00000000-0000-0000-0000-000000000001',
    role: 'HOST',
    permissions: []
} as unknown as Actor;

const fakeContext: ImportContext = {
    locale: 'es',
    timeoutMs: 10_000,
    maxBytes: 5_000_000,
    aiMaxChars: 4_000,
    credentials: {}
};

/** A minimal RawExtraction with a name so source:'none' is NOT triggered. */
const minimalExtraction: RawExtraction = {
    sourcePlatform: 'generic',
    name: { value: 'Test Place', source: 'jsonld' },
    description: { value: 'A nice place.', source: 'jsonld' }
};

/**
 * Builds a minimal fake adapter object for use with vi.fn() constructors.
 * By default supports() returns `supportsResult`; extract() returns `extraction`.
 */
function makeFakeAdapter(
    source: string,
    supportsResult: boolean,
    extraction: RawExtraction = minimalExtraction
) {
    return {
        source,
        supports: vi.fn().mockReturnValue(supportsResult),
        extract: vi.fn().mockResolvedValue(extraction)
    };
}

// ---------------------------------------------------------------------------
// Fake adapter instances (rebuilt in beforeEach)
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

    // Default: safeExternalFetch returns blocked (should not be called for
    // canonical URLs; tests that need it override this).
    mockSafeExternalFetch.mockResolvedValue({
        ok: false,
        status: 0,
        error: 'not configured in this test',
        blocked: true
    });

    // Build fresh fake adapters.
    fakeGeneric = makeFakeAdapter('generic', true);
    fakeAirbnb = makeFakeAdapter('airbnb', false);
    fakeBooking = makeFakeAdapter('booking', false);
    fakeGoogle = makeFakeAdapter('google', false);
    fakeMl = makeFakeAdapter('mercadolibre', false);

    // Wire constructors.
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

describe('AccommodationImportService — short-link resolution (Step 1b)', () => {
    // -------------------------------------------------------------------------
    // Google Maps short link: maps.app.goo.gl
    // -------------------------------------------------------------------------
    describe('when the input is a maps.app.goo.gl short link', () => {
        const shortLinkUrl = 'https://maps.app.goo.gl/dCaudGsZ8r9fKvWk9';
        const canonicalUrl =
            'https://www.google.com/maps/place/Hotel+Example/@-32.48,-58.23,17z/data=!3m1!4b1!4m6!3m5!1s0x95b0d9d7fffff:0x1234!8m2!3d-32.48!4d-58.23!16s%2Fg%2F1234ChIJexample12345678';

        it('should call safeExternalFetch to resolve the short link before adapter selection', async () => {
            // Arrange — safeExternalFetch resolves to canonical Google Maps URL
            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: '',
                finalUrl: canonicalUrl
            });
            // Google adapter supports the canonical URL, not the short link
            fakeGoogle.supports.mockImplementation((url: URL) =>
                url.hostname.includes('google.com')
            );
            fakeGoogle.extract.mockResolvedValue({
                sourcePlatform: 'google',
                name: { value: 'Hotel Example', source: 'official_api' }
            });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: shortLinkUrl, context: fakeContext },
                fakeActor
            );

            // Assert — safeExternalFetch was called with the short-link URL
            expect(mockSafeExternalFetch).toHaveBeenCalledOnce();
            expect(mockSafeExternalFetch).toHaveBeenCalledWith(
                expect.objectContaining({ url: shortLinkUrl })
            );

            // The Google adapter's supports() was called with the canonical URL
            const googleSupportsCall = fakeGoogle.supports.mock.calls[0];
            expect(googleSupportsCall).toBeDefined();
            const urlArg = googleSupportsCall?.[0] as URL;
            expect(urlArg.href).toBe(canonicalUrl);

            // The Google adapter's extract() was called with the canonical URL
            const googleExtractCall = fakeGoogle.extract.mock.calls[0];
            expect(googleExtractCall).toBeDefined();
            const extractUrlArg = googleExtractCall?.[0] as URL;
            expect(extractUrlArg.href).toBe(canonicalUrl);

            // Source labelled as 'google' (detectSource on canonical URL)
            expect(result.source).toBe('google');
        });

        it('should fall back to the original URL when safeExternalFetch returns ok:false', async () => {
            // Arrange — safeExternalFetch is blocked (e.g. private IP or timeout)
            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: false,
                status: 0,
                error: 'DNS resolution failed',
                blocked: true
            });
            // In fallback: the short-link URL itself is passed to adapters.
            // Google adapter supports maps.app.goo.gl (it does in the real impl).
            fakeGoogle.supports.mockImplementation(
                (url: URL) =>
                    url.hostname === 'maps.app.goo.gl' || url.hostname.includes('google.com')
            );
            fakeGoogle.extract.mockResolvedValue({ sourcePlatform: 'google' });

            const service = new AccommodationImportService(fakeCtx);

            // Act — should NOT throw
            await expect(
                service.importFromUrl({ url: shortLinkUrl, context: fakeContext }, fakeActor)
            ).resolves.toBeDefined();

            // The adapter's supports() was still called (with the original URL)
            expect(fakeGoogle.supports).toHaveBeenCalled();
            const urlArg = fakeGoogle.supports.mock.calls[0]?.[0] as URL;
            expect(urlArg.hostname).toBe('maps.app.goo.gl');
        });

        it('should return source:"none" when the short link resolves to nothing and extraction is empty', async () => {
            // Arrange — resolution fails, adapter returns empty extraction
            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: false,
                status: 0,
                error: 'timeout',
                blocked: true
            });
            fakeGoogle.supports.mockReturnValue(false); // no specific adapter matches
            fakeGeneric.extract.mockResolvedValue({ sourcePlatform: 'generic' }); // empty

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: shortLinkUrl, context: fakeContext },
                fakeActor
            );

            // Assert
            expect(result.source).toBe('none');
            expect(result.draft).toEqual({});
            expect(result.partial).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // Booking.com share stub: /Share-XXX path
    // -------------------------------------------------------------------------
    describe('when the input is a Booking.com /Share-XXX stub', () => {
        const shareStubUrl = 'https://www.booking.com/Share-3gN41Wp';
        const canonicalUrl = 'https://www.booking.com/hotel/ar/my-hotel.es.html';

        it('should resolve the /Share- stub to the canonical hotel page before extraction', async () => {
            // Arrange — safeExternalFetch resolves stub → canonical hotel URL
            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: '',
                finalUrl: canonicalUrl
            });
            // Booking adapter supports booking.com hotel URLs
            fakeBooking.supports.mockImplementation((url: URL) =>
                url.hostname.includes('booking.com')
            );
            fakeBooking.extract.mockResolvedValue({
                sourcePlatform: 'booking',
                name: { value: 'My Hotel', source: 'jsonld' }
            });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: shareStubUrl, context: fakeContext },
                fakeActor
            );

            // Assert — safeExternalFetch was called
            expect(mockSafeExternalFetch).toHaveBeenCalledOnce();
            expect(mockSafeExternalFetch).toHaveBeenCalledWith(
                expect.objectContaining({ url: shareStubUrl })
            );

            // Booking adapter's extract() received the canonical URL
            const extractUrlArg = fakeBooking.extract.mock.calls[0]?.[0] as URL;
            expect(extractUrlArg.href).toBe(canonicalUrl);

            // Source labelled correctly
            expect(result.source).toBe('booking');
        });

        it('should NOT resolve a canonical booking.com/hotel/... URL (no extra fetch)', async () => {
            // Arrange — canonical hotel URL, NOT a /Share- stub
            const canonicalHotelUrl = 'https://www.booking.com/hotel/ar/my-hotel.es.html';
            fakeBooking.supports.mockImplementation((url: URL) =>
                url.hostname.includes('booking.com')
            );
            fakeBooking.extract.mockResolvedValue({ sourcePlatform: 'booking' });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            await service.importFromUrl(
                { url: canonicalHotelUrl, context: fakeContext },
                fakeActor
            );

            // Assert — safeExternalFetch was NOT called for the canonical URL
            expect(mockSafeExternalFetch).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Airbnb short link: abnb.me
    // -------------------------------------------------------------------------
    describe('when the input is an abnb.me Airbnb share link', () => {
        const airbnbShortUrl = 'https://abnb.me/abc123xyz';
        const airbnbCanonical = 'https://www.airbnb.com.ar/rooms/817515602448448452';

        it('should resolve the abnb.me short link to the canonical Airbnb URL', async () => {
            // Arrange
            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: '',
                finalUrl: airbnbCanonical
            });
            fakeAirbnb.supports.mockImplementation((url: URL) => url.hostname.includes('airbnb.'));
            fakeAirbnb.extract.mockResolvedValue({
                sourcePlatform: 'airbnb',
                name: { value: 'Cabaña', source: 'official_api' }
            });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            const result = await service.importFromUrl(
                { url: airbnbShortUrl, context: fakeContext },
                fakeActor
            );

            // Assert — resolution happened
            expect(mockSafeExternalFetch).toHaveBeenCalledOnce();

            // Airbnb adapter was selected and received the canonical URL
            const extractUrlArg = fakeAirbnb.extract.mock.calls[0]?.[0] as URL;
            expect(extractUrlArg.href).toBe(airbnbCanonical);

            // Source is 'airbnb' (from detectSource on the canonical URL)
            expect(result.source).toBe('airbnb');
        });
    });

    // -------------------------------------------------------------------------
    // Already-canonical URLs: NO extra fetch round-trip
    // -------------------------------------------------------------------------
    describe('when the URL is already canonical (not a short link)', () => {
        it('should NOT call safeExternalFetch for an airbnb.com/rooms/... URL', async () => {
            // Arrange
            const canonicalAirbnb = 'https://www.airbnb.com.ar/rooms/817515602448448452';
            fakeAirbnb.supports.mockReturnValue(true);
            fakeAirbnb.extract.mockResolvedValue({
                sourcePlatform: 'airbnb',
                name: { value: 'Cabaña', source: 'official_api' }
            });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            await service.importFromUrl({ url: canonicalAirbnb, context: fakeContext }, fakeActor);

            // Assert — no resolution fetch for canonical URLs
            expect(mockSafeExternalFetch).not.toHaveBeenCalled();
        });

        it('should NOT call safeExternalFetch for a maps.google.com/maps/... URL', async () => {
            // Arrange
            const canonicalGoogleMaps =
                'https://www.google.com/maps/place/Hostel+Example/@-32.48,-58.23,17z';
            fakeGoogle.supports.mockReturnValue(true);
            fakeGoogle.extract.mockResolvedValue({
                sourcePlatform: 'google',
                name: { value: 'Hostel Example', source: 'official_api' }
            });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            await service.importFromUrl(
                { url: canonicalGoogleMaps, context: fakeContext },
                fakeActor
            );

            // Assert
            expect(mockSafeExternalFetch).not.toHaveBeenCalled();
        });

        it('should NOT call safeExternalFetch for a mercadolibre URL', async () => {
            // Arrange
            const mlUrl = 'https://inmuebles.mercadolibre.com.ar/MLA-123456789';
            fakeMl.supports.mockReturnValue(true);
            fakeMl.extract.mockResolvedValue({ sourcePlatform: 'mercadolibre' });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            await service.importFromUrl({ url: mlUrl, context: fakeContext }, fakeActor);

            // Assert
            expect(mockSafeExternalFetch).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Graceful degradation: resolution failure never breaks the pipeline
    // -------------------------------------------------------------------------
    describe('graceful degradation when resolution fails', () => {
        it('should still call the adapter with the original URL when safeExternalFetch throws unexpectedly', async () => {
            // Arrange — even though safeExternalFetch is documented not to throw,
            // guard against unexpected throws
            mockSafeExternalFetch.mockRejectedValueOnce(new Error('Unexpected internal error'));

            fakeGoogle.supports.mockImplementation(
                (url: URL) => url.hostname === 'maps.app.goo.gl'
            );
            fakeGoogle.extract.mockResolvedValue({ sourcePlatform: 'google' });

            const service = new AccommodationImportService(fakeCtx);

            // Act — must not throw
            const result = await service.importFromUrl(
                { url: 'https://maps.app.goo.gl/dCaudGsZ8r9fKvWk9', context: fakeContext },
                fakeActor
            );

            // Assert — pipeline completed (degrade gracefully)
            expect(result).toBeDefined();
            expect(result.partial).toBe(true);
        });

        it('should use the original URL when finalUrl equals the input (no redirect happened)', async () => {
            // Arrange — safeExternalFetch returns success but finalUrl === inputUrl
            // (the server responded 200 without any redirect)
            const shortLink = 'https://maps.app.goo.gl/sometoken';
            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: 'some content',
                finalUrl: shortLink // same as input — no redirect
            });
            fakeGoogle.supports.mockImplementation(
                (url: URL) => url.hostname === 'maps.app.goo.gl'
            );
            fakeGoogle.extract.mockResolvedValue({ sourcePlatform: 'google' });

            const service = new AccommodationImportService(fakeCtx);

            // Act
            await service.importFromUrl({ url: shortLink, context: fakeContext }, fakeActor);

            // Assert — adapter received the original URL (finalUrl === input, no change)
            const urlArg = fakeGoogle.supports.mock.calls[0]?.[0] as URL;
            expect(urlArg.hostname).toBe('maps.app.goo.gl');
        });
    });

    // -------------------------------------------------------------------------
    // safeExternalFetch is called with correct parameters
    // -------------------------------------------------------------------------
    describe('safeExternalFetch call parameters for short-link resolution', () => {
        it('should pass the context timeoutMs and a capped maxBytes to safeExternalFetch', async () => {
            // Arrange
            const shortLink = 'https://maps.app.goo.gl/dCaudGsZ8r9fKvWk9';
            mockSafeExternalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: '',
                finalUrl: 'https://www.google.com/maps/place/Hotel+X/@-32,58,17z'
            });
            fakeGoogle.supports.mockReturnValue(true);
            fakeGoogle.extract.mockResolvedValue({ sourcePlatform: 'google' });

            const contextWith5sTimeout: ImportContext = { ...fakeContext, timeoutMs: 5_000 };
            const service = new AccommodationImportService(fakeCtx);

            // Act
            await service.importFromUrl(
                { url: shortLink, context: contextWith5sTimeout },
                fakeActor
            );

            // Assert — timeoutMs forwarded from context, maxBytes is a small cap
            expect(mockSafeExternalFetch).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: shortLink,
                    timeoutMs: 5_000,
                    maxBytes: expect.any(Number)
                })
            );

            // maxBytes must be a positive number (we use 512 for redirect resolution)
            const callArgs = mockSafeExternalFetch.mock.calls[0]?.[0];
            expect(callArgs?.maxBytes).toBeGreaterThan(0);
            expect(callArgs?.maxBytes).toBeLessThanOrEqual(1024); // sanity: small cap
        });
    });
});

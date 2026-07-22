/**
 * Unit tests for finalizeImportDraft (HOS-50 T-009)
 *
 * `finalizeImportDraft` is the extracted "steps 4+" post-raw-extraction
 * pipeline from `AccommodationImportService.importFromUrl` (mapRawToDraft,
 * amenity resolution, destination hint, media hints, response assembly).
 * The resolver modules are mocked so no real DB access occurs; this suite
 * exercises the function directly, in isolation, with a fixed RawExtraction
 * fixture per source.
 *
 * The full `AccommodationImportService` regression suite
 * (`accommodation-import.service.test.ts`) continues to exercise the same
 * logic indirectly through the synchronous `importFromUrl` flow, confirming
 * this extraction introduced no behavior change.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RawExtraction } from '../../../src/services/accommodation-import/adapter.types.js';
import type { ExchangeRateConfigService } from '../../../src/services/exchange-rate/exchange-rate-config.service.js';
import type { ExchangeRateFetcher } from '../../../src/services/exchange-rate/exchange-rate-fetcher.js';
import type { Actor } from '../../../src/types/index.js';

vi.mock('../../../src/services/accommodation-import/resolvers/amenities.js', () => ({
    resolveAmenities: vi.fn()
}));
vi.mock('../../../src/services/accommodation-import/resolvers/destination.js', () => ({
    buildDestinationHint: vi.fn()
}));

import { finalizeImportDraft } from '../../../src/services/accommodation-import/finalize-import-draft.js';
import { resolveAmenities } from '../../../src/services/accommodation-import/resolvers/amenities.js';
import { buildDestinationHint } from '../../../src/services/accommodation-import/resolvers/destination.js';

const mockResolveAmenities = vi.mocked(resolveAmenities);
const mockBuildDestinationHint = vi.mocked(buildDestinationHint);

const fakeActor: Actor = {
    id: '00000000-0000-0000-0000-000000000001',
    role: 'HOST',
    permissions: []
} as unknown as Actor;

// Fake service instances — never dereferenced, since resolveAmenities /
// buildDestinationHint are themselves mocked and only receive them as an
// opaque pass-through parameter.
const fakeAmenityService = {} as never;
const fakeDestinationService = {} as never;

const UUID_AMENITY_WIFI = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const UUID_DEST_001 = 'b1c2d3e4-f5a6-4b7c-8d9e-f0a1b2c3d4e5';

function makeCtx(source: RawExtraction['sourcePlatform'] = 'generic') {
    return {
        source,
        actor: fakeActor,
        amenityService: fakeAmenityService,
        destinationService: fakeDestinationService
    };
}

describe('finalizeImportDraft', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveAmenities.mockResolvedValue({ amenityIds: [], unresolved: [] });
        mockBuildDestinationHint.mockResolvedValue({ candidates: [] });
    });

    it('maps a rich RawExtraction into a populated draft with methodsUsed and mediaHints', async () => {
        const raw: RawExtraction = {
            sourcePlatform: 'generic',
            name: { value: 'Cabaña del Río', source: 'jsonld' },
            summary: { value: 'A cozy cabin by the river.', source: 'opengraph' },
            imageUrls: ['https://example.com/img1.jpg'],
            amenityNames: ['WiFi'],
            scrapedLocality: 'Concepción del Uruguay'
        };
        mockResolveAmenities.mockResolvedValue({
            amenityIds: [UUID_AMENITY_WIFI],
            unresolved: []
        });
        mockBuildDestinationHint.mockResolvedValue({
            scrapedLocality: 'Concepción del Uruguay',
            candidates: [{ id: UUID_DEST_001, name: 'Concepción del Uruguay' }]
        });

        const result = await finalizeImportDraft(raw, makeCtx('generic'));

        expect(result.draft).toMatchObject({
            name: expect.objectContaining({ value: 'Cabaña del Río' }),
            summary: expect.objectContaining({ value: 'A cozy cabin by the river.' })
        });
        expect(result.source).toBe('generic');
        expect(result.partial).toBe(true); // no `type` field
        expect(result.mediaHints).toEqual({ imageUrls: ['https://example.com/img1.jpg'] });
        expect(result.resolvedAmenityIds).toEqual([UUID_AMENITY_WIFI]);
        expect(result.destinationHint).toEqual({
            scrapedLocality: 'Concepción del Uruguay',
            candidates: [{ id: UUID_DEST_001, name: 'Concepción del Uruguay' }]
        });
        expect(result.failureCode).toBeUndefined();
    });

    it('propagates raw.failureCode onto the response', async () => {
        const raw: RawExtraction = { sourcePlatform: 'airbnb', failureCode: 'provider_error' };

        const result = await finalizeImportDraft(raw, makeCtx('airbnb'));

        expect(result.failureCode).toBe('provider_error');
        expect(result.source).toBe('none');
        expect(result.draft).toEqual({});
        expect(result.partial).toBe(true);
    });

    it('falls back to nothing_found when the draft is empty and no hints exist', async () => {
        const raw: RawExtraction = { sourcePlatform: 'booking' };

        const result = await finalizeImportDraft(raw, makeCtx('booking'));

        expect(result.failureCode).toBe('nothing_found');
        expect(result.source).toBe('none');
    });

    it('omits failureCode when the draft has content, even if not complete', async () => {
        const raw: RawExtraction = {
            sourcePlatform: 'mercadolibre',
            name: { value: 'Casa Sol', source: 'jsonld' }
        };

        const result = await finalizeImportDraft(raw, makeCtx('mercadolibre'));

        expect(result.failureCode).toBeUndefined();
        expect(result.source).toBe('mercadolibre');
        expect(result.partial).toBe(true);
    });

    it('omits resolvedAmenityIds/unresolvedAmenities when resolveAmenities throws', async () => {
        mockResolveAmenities.mockRejectedValue(new Error('amenity service down'));
        const raw: RawExtraction = {
            sourcePlatform: 'generic',
            name: { value: 'Casa Sol', source: 'jsonld' },
            amenityNames: ['WiFi']
        };

        const result = await finalizeImportDraft(raw, makeCtx('generic'));

        expect(result.resolvedAmenityIds).toBeUndefined();
        expect(result.unresolvedAmenities).toBeUndefined();
        expect(result.failureCode).toBeUndefined();
    });

    it('omits destinationHint when buildDestinationHint throws', async () => {
        mockBuildDestinationHint.mockRejectedValue(new Error('DB unreachable'));
        const raw: RawExtraction = {
            sourcePlatform: 'generic',
            name: { value: 'Casa Sol', source: 'jsonld' },
            scrapedLocality: 'Concepción del Uruguay'
        };

        const result = await finalizeImportDraft(raw, makeCtx('generic'));

        expect(result.destinationHint).toBeUndefined();
    });

    it('never sets destinationId (SPEC-222 AC-8.2)', async () => {
        const raw: RawExtraction = {
            sourcePlatform: 'generic',
            name: { value: 'Casa Sol', source: 'jsonld' }
        };

        const result = await finalizeImportDraft(raw, makeCtx('generic'));

        expect(result.draft).not.toHaveProperty('destinationId');
    });

    describe('price conversion (BETA-181)', () => {
        const usdRaw: RawExtraction = {
            sourcePlatform: 'airbnb',
            name: { value: 'Casa Sol', source: 'jsonld' },
            price: {
                price: { value: 100, source: 'jsonld' },
                currency: { value: 'USD', source: 'jsonld' }
            }
        };

        it('converts a USD draft price to ARS and surfaces priceConversion when exchange-rate deps are provided', async () => {
            const exchangeRateFetcher = {
                getRateWithFallback: async () => ({
                    rate: {
                        id: 'rate-1',
                        fromCurrency: 'USD',
                        toCurrency: 'ARS',
                        rate: 1500,
                        inverseRate: 1 / 1500,
                        rateType: 'oficial',
                        source: 'dolarapi',
                        isManualOverride: false,
                        fetchedAt: new Date(),
                        expiresAt: null,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    },
                    quality: 'fresh'
                })
            } as unknown as ExchangeRateFetcher;
            const exchangeRateConfigService = {
                getConfig: async () => ({ data: { defaultRateType: 'oficial' } })
            } as unknown as ExchangeRateConfigService;

            const result = await finalizeImportDraft(usdRaw, {
                ...makeCtx('airbnb'),
                exchangeRateFetcher,
                exchangeRateConfigService
            });

            expect(result.draft.price?.price?.value).toBe(150000);
            expect(result.draft.price?.currency?.value).toBe('ARS');
            expect(result.priceConversion).toEqual({
                originalPrice: 100,
                originalCurrency: 'USD',
                convertedPrice: 150000,
                currency: 'ARS',
                rate: 1500,
                rateType: 'oficial'
            });
        });

        it('leaves the price untouched and omits priceConversion when no exchange-rate deps are provided', async () => {
            const result = await finalizeImportDraft(usdRaw, makeCtx('airbnb'));

            expect(result.draft.price?.price?.value).toBe(100);
            expect(result.draft.price?.currency?.value).toBe('USD');
            expect(result.priceConversion).toBeUndefined();
        });

        it('leaves the price untouched when conversion is not possible (e.g. no rate)', async () => {
            const exchangeRateFetcher = {
                getRateWithFallback: async () => ({ rate: null, quality: 'not_found' })
            } as unknown as ExchangeRateFetcher;
            const exchangeRateConfigService = {
                getConfig: async () => ({ data: { defaultRateType: 'oficial' } })
            } as unknown as ExchangeRateConfigService;

            const result = await finalizeImportDraft(usdRaw, {
                ...makeCtx('airbnb'),
                exchangeRateFetcher,
                exchangeRateConfigService
            });

            expect(result.draft.price?.price?.value).toBe(100);
            expect(result.draft.price?.currency?.value).toBe('USD');
            expect(result.priceConversion).toBeUndefined();
        });
    });
});

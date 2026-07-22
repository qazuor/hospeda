/**
 * Unit tests for handleImportStatusPoll (HOS-50 T-011)
 *
 * `handleImportStatusPoll` is the core logic of
 * `GET /api/v1/protected/accommodations/import-from-url/status`, extracted
 * into a directly-testable function (same pattern as `buildImportAiExtract`
 * in `import-from-url.gate.test.ts`) so it can be exercised without a full
 * Hono app / auth harness.
 *
 * `resolveImportRunStatus` and `finalizeImportDraft` (both from
 * `@repo/service-core`) are mocked so no real Apify calls or DB access occur.
 */

import type { AccommodationImportStatusQuery } from '@repo/schemas';
import type { Actor, ImportContext } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolveImportRunStatus, mockFinalizeImportDraft } = vi.hoisted(() => ({
    mockResolveImportRunStatus: vi.fn(),
    mockFinalizeImportDraft: vi.fn()
}));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        resolveImportRunStatus: mockResolveImportRunStatus,
        finalizeImportDraft: mockFinalizeImportDraft
    };
});

import { handleImportStatusPoll } from '../../../../src/routes/accommodation/protected/import-from-url-status';

const fakeActor = { id: 'user-1', permissions: [] } as unknown as Actor;
const fakeAmenityService = {} as never;
const fakeDestinationService = {} as never;

function makeContext(overrides?: Partial<ImportContext>): ImportContext {
    return {
        locale: 'es',
        timeoutMs: 8_000,
        apifyTimeoutMs: 120_000,
        maxBytes: 3_000_000,
        aiMaxChars: 12_000,
        credentials: { apifyToken: 'test-apify-token' },
        ...overrides
    };
}

function makeQuery(
    overrides?: Partial<AccommodationImportStatusQuery>
): AccommodationImportStatusQuery {
    return {
        runId: 'run-1',
        datasetId: 'ds-1',
        source: 'airbnb',
        startedAt: '2026-07-02T10:00:00.000Z',
        url: 'https://airbnb.com/rooms/1',
        ...overrides
    };
}

const NOW = new Date('2026-07-02T10:00:10.000Z').getTime(); // 10s after startedAt

describe('handleImportStatusPoll', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns settled:false when resolveImportRunStatus reports the run is still going', async () => {
        mockResolveImportRunStatus.mockResolvedValue({ settled: false });

        const result = await handleImportStatusPoll(makeQuery(), {
            context: makeContext(),
            actor: fakeActor,
            amenityService: fakeAmenityService,
            destinationService: fakeDestinationService,
            now: NOW
        });

        expect(result).toEqual({ settled: false });
        expect(mockFinalizeImportDraft).not.toHaveBeenCalled();
    });

    it('passes raw through finalizeImportDraft and returns a draft-shaped response on success', async () => {
        const raw = {
            sourcePlatform: 'airbnb' as const,
            name: { value: 'Casa Sol', source: 'official_api' as const }
        };
        mockResolveImportRunStatus.mockResolvedValue({ settled: true, raw });
        const finalized = {
            draft: { name: { value: 'Casa Sol', source: 'official_api', confidence: 90 } },
            source: 'airbnb' as const,
            methodsUsed: ['official_api' as const],
            partial: true
        };
        mockFinalizeImportDraft.mockResolvedValue(finalized);

        const result = await handleImportStatusPoll(makeQuery(), {
            context: makeContext(),
            actor: fakeActor,
            amenityService: fakeAmenityService,
            destinationService: fakeDestinationService,
            now: NOW
        });

        expect(mockFinalizeImportDraft).toHaveBeenCalledWith(
            raw,
            expect.objectContaining({ source: 'airbnb', actor: fakeActor })
        );
        expect(result).toEqual({ settled: true, draft: finalized });
    });

    it('returns the failureCode directly when the run settled with a failure', async () => {
        mockResolveImportRunStatus.mockResolvedValue({
            settled: true,
            failureCode: 'provider_error'
        });

        const result = await handleImportStatusPoll(makeQuery(), {
            context: makeContext(),
            actor: fakeActor,
            amenityService: fakeAmenityService,
            destinationService: fakeDestinationService,
            now: NOW
        });

        expect(result).toEqual({ settled: true, failureCode: 'provider_error' });
        expect(mockFinalizeImportDraft).not.toHaveBeenCalled();
    });

    it('short-circuits to timeout without calling resolveImportRunStatus when the poll ceiling is exceeded', async () => {
        // apifyTimeoutMs = 120_000ms; startedAt + 121s > ceiling.
        const farFuture = new Date('2026-07-02T10:00:00.000Z').getTime() + 121_000;

        const result = await handleImportStatusPoll(makeQuery(), {
            context: makeContext({ apifyTimeoutMs: 120_000 }),
            actor: fakeActor,
            amenityService: fakeAmenityService,
            destinationService: fakeDestinationService,
            now: farFuture
        });

        expect(result).toEqual({ settled: true, failureCode: 'timeout' });
        expect(mockResolveImportRunStatus).not.toHaveBeenCalled();
    });

    it('returns credentials_missing without calling resolveImportRunStatus when the Apify token is absent', async () => {
        const result = await handleImportStatusPoll(makeQuery(), {
            context: makeContext({ credentials: {} }),
            actor: fakeActor,
            amenityService: fakeAmenityService,
            destinationService: fakeDestinationService,
            now: NOW
        });

        expect(result).toEqual({ settled: true, failureCode: 'credentials_missing' });
        expect(mockResolveImportRunStatus).not.toHaveBeenCalled();
    });

    it('forwards exchange-rate deps to finalizeImportDraft and passes a priceConversion advisory through untouched (BETA-181)', async () => {
        const raw = {
            sourcePlatform: 'airbnb' as const,
            price: {
                price: { value: 100, source: 'jsonld' as const },
                currency: { value: 'USD', source: 'jsonld' as const }
            }
        };
        mockResolveImportRunStatus.mockResolvedValue({ settled: true, raw });
        const finalized = {
            draft: {
                price: {
                    price: { value: 150000, source: 'jsonld', confidence: 70 },
                    currency: { value: 'ARS', source: 'jsonld', confidence: 70 }
                }
            },
            source: 'airbnb' as const,
            methodsUsed: ['jsonld' as const],
            partial: true,
            priceConversion: {
                originalPrice: 100,
                originalCurrency: 'USD',
                convertedPrice: 150000,
                currency: 'ARS' as const,
                rate: 1500,
                rateType: 'oficial'
            }
        };
        mockFinalizeImportDraft.mockResolvedValue(finalized);

        const fakeExchangeRateFetcher = { getRateWithFallback: vi.fn() } as never;
        const fakeExchangeRateConfigService = { getConfig: vi.fn() } as never;

        const result = await handleImportStatusPoll(makeQuery(), {
            context: makeContext(),
            actor: fakeActor,
            amenityService: fakeAmenityService,
            destinationService: fakeDestinationService,
            exchangeRateFetcher: fakeExchangeRateFetcher,
            exchangeRateConfigService: fakeExchangeRateConfigService,
            now: NOW
        });

        expect(mockFinalizeImportDraft).toHaveBeenCalledWith(
            raw,
            expect.objectContaining({
                exchangeRateFetcher: fakeExchangeRateFetcher,
                exchangeRateConfigService: fakeExchangeRateConfigService
            })
        );
        expect(result).toEqual({ settled: true, draft: finalized });
    });

    it('rejects a source outside airbnb/booking (the only async-capable sources)', async () => {
        await expect(
            handleImportStatusPoll(makeQuery({ source: 'generic' }), {
                context: makeContext(),
                actor: fakeActor,
                amenityService: fakeAmenityService,
                destinationService: fakeDestinationService,
                now: NOW
            })
        ).rejects.toThrow();
        expect(mockResolveImportRunStatus).not.toHaveBeenCalled();
    });
});

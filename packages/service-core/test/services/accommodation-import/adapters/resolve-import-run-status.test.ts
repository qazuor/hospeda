/**
 * Unit tests for the async import run-status resolver (HOS-50 / SPEC-277 R3)
 *
 * `resolveImportRunStatus` polls a single Apify run via `getApifyRunStatus`
 * and, once it reaches `SUCCEEDED`, fetches the dataset and maps the first
 * item to a `RawExtraction` using the same per-source mapper the synchronous
 * adapters already use. The `apify-client`, `airbnb.adapter`, `booking.adapter`,
 * and `generic.adapter` modules are mocked so no real HTTP calls occur and the
 * per-source mapping / fallback dispatch can be asserted in isolation.
 *
 * Covers both:
 * - T-005: the non-terminal (`READY`/`RUNNING`) and `SUCCEEDED` branches.
 * - T-006: the terminal-failure branch (`FAILED`/`TIMED-OUT`/`ABORTED`), the
 *   R2 Generic-adapter fallback it triggers on `source_blocked`/`provider_error`,
 *   and the "useful fallback" acceptance rule mirrored from the sync path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImportContext } from '../../../../src/services/accommodation-import/adapter.types.js';

// ---------------------------------------------------------------------------
// Mock the apify-client module so no real HTTP calls occur
// ---------------------------------------------------------------------------

vi.mock('../../../../src/services/accommodation-import/adapters/apify-client.js', () => ({
    getApifyRunStatus: vi.fn(),
    getApifyDatasetItems: vi.fn()
}));

// ---------------------------------------------------------------------------
// Mock the per-source item mappers so the sync adapters' HTTP/JSON-LD logic
// never runs — only the dispatch to the correct mapper is under test here.
// ---------------------------------------------------------------------------

vi.mock('../../../../src/services/accommodation-import/adapters/airbnb.adapter.js', () => ({
    mapItemToRawExtraction: vi.fn()
}));

vi.mock('../../../../src/services/accommodation-import/adapters/booking.adapter.js', () => ({
    mapApifyItemToRawExtraction: vi.fn()
}));

// ---------------------------------------------------------------------------
// Mock GenericAdapter (R2 fallback) — same pattern as
// accommodation-import.service.test.ts: the constructor is a vi.fn() wired
// per-test to return a fake instance with a controllable `extract`.
// ---------------------------------------------------------------------------

vi.mock('../../../../src/services/accommodation-import/adapters/generic.adapter.js', () => ({
    GenericAdapter: vi.fn()
}));

// Import the mock references AFTER vi.mock so TypeScript and vitest are aligned
import { mapItemToRawExtraction } from '../../../../src/services/accommodation-import/adapters/airbnb.adapter.js';
import {
    getApifyDatasetItems,
    getApifyRunStatus
} from '../../../../src/services/accommodation-import/adapters/apify-client.js';
import { mapApifyItemToRawExtraction } from '../../../../src/services/accommodation-import/adapters/booking.adapter.js';
import { GenericAdapter } from '../../../../src/services/accommodation-import/adapters/generic.adapter.js';
import { resolveImportRunStatus } from '../../../../src/services/accommodation-import/adapters/resolve-import-run-status.js';

const mockGetApifyRunStatus = vi.mocked(getApifyRunStatus);
const mockGetApifyDatasetItems = vi.mocked(getApifyDatasetItems);
const mockMapAirbnbItem = vi.mocked(mapItemToRawExtraction);
const mockMapBookingItem = vi.mocked(mapApifyItemToRawExtraction);
const mockGenericAdapter = vi.mocked(GenericAdapter);

/**
 * Minimal valid {@link ImportContext}, mirroring the shared fixture pattern
 * from `airbnb.adapter.test.ts`.
 */
function makeCtx(): ImportContext {
    return {
        locale: 'es',
        timeoutMs: 15_000,
        maxBytes: 5_000_000,
        aiMaxChars: 4_000,
        credentials: {
            apifyToken: 'test-apify-token',
            apifyAirbnbActor: 'apify/airbnb-scraper',
            apifyBookingActor: 'apify/booking-scraper'
        }
    };
}

/**
 * Builds a fake GenericAdapter instance with a controllable `extract`, and
 * wires the mocked constructor to return it — same pattern as
 * `accommodation-import.service.test.ts`.
 */
function useFakeGenericAdapter(extractImpl: (url: URL, ctx: ImportContext) => Promise<unknown>) {
    const fakeGeneric = {
        source: 'generic',
        supports: vi.fn(),
        extract: vi.fn<(url: URL, ctx: ImportContext) => Promise<unknown>>(extractImpl)
    };
    mockGenericAdapter.mockImplementation(
        () => fakeGeneric as unknown as InstanceType<typeof GenericAdapter>
    );
    return fakeGeneric;
}

describe('resolveImportRunStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('T-005: non-terminal and SUCCEEDED branches', () => {
        it('returns settled:false when the run status is RUNNING', async () => {
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'RUNNING',
                defaultDatasetId: 'ds-1'
            });

            const result = await resolveImportRunStatus({
                token: 'tok',
                runId: 'run-1',
                datasetId: 'ds-1',
                source: 'airbnb',
                url: 'https://airbnb.com/rooms/1',
                context: makeCtx()
            });

            expect(result).toEqual({ settled: false });
            expect(mockGetApifyDatasetItems).not.toHaveBeenCalled();
        });

        it('returns settled:false when the run status is READY', async () => {
            mockGetApifyRunStatus.mockResolvedValue({ status: 'READY', defaultDatasetId: 'ds-1' });

            const result = await resolveImportRunStatus({
                token: 'tok',
                runId: 'run-1',
                datasetId: 'ds-1',
                source: 'airbnb',
                url: 'https://airbnb.com/rooms/1',
                context: makeCtx()
            });

            expect(result).toEqual({ settled: false });
            expect(mockGetApifyDatasetItems).not.toHaveBeenCalled();
        });

        it('maps the first dataset item via the airbnb mapper on SUCCEEDED for source=airbnb', async () => {
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'SUCCEEDED',
                defaultDatasetId: 'ds-1'
            });
            const firstItem = { name: 'Cabaña del Río' };
            mockGetApifyDatasetItems.mockResolvedValue([
                firstItem,
                { name: 'ignored second item' }
            ]);
            const raw = {
                sourcePlatform: 'airbnb' as const,
                name: { value: 'Cabaña del Río', source: 'official_api' as const }
            };
            mockMapAirbnbItem.mockReturnValue(raw);

            const result = await resolveImportRunStatus({
                token: 'tok',
                runId: 'run-1',
                datasetId: 'ds-1',
                source: 'airbnb',
                url: 'https://airbnb.com/rooms/1',
                context: makeCtx()
            });

            expect(mockGetApifyDatasetItems).toHaveBeenCalledWith({
                token: 'tok',
                datasetId: 'ds-1'
            });
            expect(mockMapAirbnbItem).toHaveBeenCalledWith(firstItem);
            expect(mockMapBookingItem).not.toHaveBeenCalled();
            expect(result).toEqual({ settled: true, raw });
        });

        it('maps the first dataset item via the booking mapper on SUCCEEDED for source=booking', async () => {
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'SUCCEEDED',
                defaultDatasetId: 'ds-2'
            });
            const firstItem = { name: 'Hotel Central' };
            mockGetApifyDatasetItems.mockResolvedValue([firstItem]);
            const raw = {
                sourcePlatform: 'booking' as const,
                name: { value: 'Hotel Central', source: 'official_api' as const }
            };
            mockMapBookingItem.mockReturnValue(raw);

            const result = await resolveImportRunStatus({
                token: 'tok',
                runId: 'run-2',
                datasetId: 'ds-2',
                source: 'booking',
                url: 'https://booking.com/hotel/ar/sol.html',
                context: makeCtx()
            });

            expect(mockMapBookingItem).toHaveBeenCalledWith(firstItem);
            expect(mockMapAirbnbItem).not.toHaveBeenCalled();
            expect(result).toEqual({ settled: true, raw });
        });

        it('returns nothing_found when SUCCEEDED but the dataset is empty', async () => {
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'SUCCEEDED',
                defaultDatasetId: 'ds-1'
            });
            mockGetApifyDatasetItems.mockResolvedValue([]);

            const result = await resolveImportRunStatus({
                token: 'tok',
                runId: 'run-1',
                datasetId: 'ds-1',
                source: 'airbnb',
                url: 'https://airbnb.com/rooms/1',
                context: makeCtx()
            });

            expect(result).toEqual({ settled: true, failureCode: 'nothing_found' });
            expect(mockMapAirbnbItem).not.toHaveBeenCalled();
        });

        it('returns provider_error when getApifyRunStatus is unreachable (returns null)', async () => {
            mockGetApifyRunStatus.mockResolvedValue(null);

            const result = await resolveImportRunStatus({
                token: 'tok',
                runId: 'run-1',
                datasetId: 'ds-1',
                source: 'airbnb',
                url: 'https://airbnb.com/rooms/1',
                context: makeCtx()
            });

            expect(result).toEqual({ settled: true, failureCode: 'provider_error' });
            expect(mockGetApifyDatasetItems).not.toHaveBeenCalled();
        });

        it('uses the datasetId echoed by the caller, not defaultDatasetId from the status response', async () => {
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'SUCCEEDED',
                defaultDatasetId: 'ds-from-status'
            });
            mockGetApifyDatasetItems.mockResolvedValue([{ name: 'x' }]);
            mockMapAirbnbItem.mockReturnValue({ sourcePlatform: 'airbnb' });

            await resolveImportRunStatus({
                token: 'tok',
                runId: 'run-1',
                datasetId: 'ds-echoed-by-client',
                source: 'airbnb',
                url: 'https://airbnb.com/rooms/1',
                context: makeCtx()
            });

            expect(mockGetApifyDatasetItems).toHaveBeenCalledWith({
                token: 'tok',
                datasetId: 'ds-echoed-by-client'
            });
        });
    });

    describe('T-006: terminal-failure branch + R2 fallback', () => {
        it('FAILED -> fallback succeeds (useful fields) -> settled with raw tagged back to the original source', async () => {
            mockGetApifyRunStatus.mockResolvedValue({ status: 'FAILED', defaultDatasetId: 'ds-1' });
            const fakeGeneric = useFakeGenericAdapter(async () => ({
                sourcePlatform: 'generic',
                name: { value: 'Cabaña del Río (fallback)', source: 'jsonld' },
                summary: { value: 'A cozy cabin', source: 'opengraph' }
            }));

            const result = await resolveImportRunStatus({
                token: 'tok',
                runId: 'run-1',
                datasetId: 'ds-1',
                source: 'airbnb',
                url: 'https://airbnb.com/rooms/1',
                context: makeCtx()
            });

            expect(fakeGeneric.extract).toHaveBeenCalledTimes(1);
            const [calledUrl] = fakeGeneric.extract.mock.calls[0] as [URL, ImportContext];
            expect(calledUrl.href).toBe('https://airbnb.com/rooms/1');
            expect(result).toEqual({
                settled: true,
                raw: {
                    sourcePlatform: 'airbnb',
                    name: { value: 'Cabaña del Río (fallback)', source: 'jsonld' },
                    summary: { value: 'A cozy cabin', source: 'opengraph' },
                    failureCode: undefined
                }
            });
        });

        it('FAILED -> fallback yields nothing useful -> settled with the original failureCode', async () => {
            mockGetApifyRunStatus.mockResolvedValue({ status: 'FAILED', defaultDatasetId: 'ds-1' });
            useFakeGenericAdapter(async () => ({ sourcePlatform: 'generic' }));

            const result = await resolveImportRunStatus({
                token: 'tok',
                runId: 'run-1',
                datasetId: 'ds-1',
                source: 'airbnb',
                url: 'https://airbnb.com/rooms/1',
                context: makeCtx()
            });

            expect(result).toEqual({ settled: true, failureCode: 'provider_error' });
        });

        it('TIMED-OUT -> timeout, fallback NOT attempted', async () => {
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'TIMED-OUT',
                defaultDatasetId: 'ds-1'
            });
            const fakeGeneric = useFakeGenericAdapter(async () => ({ sourcePlatform: 'generic' }));

            const result = await resolveImportRunStatus({
                token: 'tok',
                runId: 'run-1',
                datasetId: 'ds-1',
                source: 'airbnb',
                url: 'https://airbnb.com/rooms/1',
                context: makeCtx()
            });

            expect(result).toEqual({ settled: true, failureCode: 'timeout' });
            expect(fakeGeneric.extract).not.toHaveBeenCalled();
        });

        it('ABORTED -> fallback succeeds via imageUrls only', async () => {
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'ABORTED',
                defaultDatasetId: 'ds-1'
            });
            useFakeGenericAdapter(async () => ({
                sourcePlatform: 'generic',
                imageUrls: ['https://example.com/1.jpg']
            }));

            const result = await resolveImportRunStatus({
                token: 'tok',
                runId: 'run-1',
                datasetId: 'ds-1',
                source: 'booking',
                url: 'https://booking.com/hotel/ar/sol.html',
                context: makeCtx()
            });

            expect(result).toEqual({
                settled: true,
                raw: {
                    sourcePlatform: 'booking',
                    imageUrls: ['https://example.com/1.jpg'],
                    failureCode: undefined
                }
            });
        });

        it('ABORTED -> GenericAdapter.extract throws -> degrades to the original failureCode (never throws)', async () => {
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'ABORTED',
                defaultDatasetId: 'ds-1'
            });
            useFakeGenericAdapter(async () => {
                throw new Error('network boom');
            });

            const result = await resolveImportRunStatus({
                token: 'tok',
                runId: 'run-1',
                datasetId: 'ds-1',
                source: 'airbnb',
                url: 'https://airbnb.com/rooms/1',
                context: makeCtx()
            });

            expect(result).toEqual({ settled: true, failureCode: 'provider_error' });
        });
    });
});

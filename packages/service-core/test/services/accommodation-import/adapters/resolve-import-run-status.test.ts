/**
 * Unit tests for the async import run-status resolver (HOS-50 / SPEC-277 R3)
 *
 * `resolveImportRunStatus` polls a single Apify run via `getApifyRunStatus`
 * and, once it reaches `SUCCEEDED`, fetches the dataset and maps the first
 * item to a `RawExtraction` using the same per-source mapper the synchronous
 * adapters already use. The `apify-client`, `airbnb.adapter`, and
 * `booking.adapter` modules are mocked so no real HTTP calls occur and the
 * per-source mapping dispatch can be asserted in isolation.
 *
 * This suite covers only the running/succeeded branches (T-005). The
 * terminal-failure branch (FAILED/TIMED-OUT/ABORTED + R2 fallback) is added
 * by T-006, which extends this same module.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

// Import the mock references AFTER vi.mock so TypeScript and vitest are aligned
import { mapItemToRawExtraction } from '../../../../src/services/accommodation-import/adapters/airbnb.adapter.js';
import {
    getApifyDatasetItems,
    getApifyRunStatus
} from '../../../../src/services/accommodation-import/adapters/apify-client.js';
import { mapApifyItemToRawExtraction } from '../../../../src/services/accommodation-import/adapters/booking.adapter.js';
import { resolveImportRunStatus } from '../../../../src/services/accommodation-import/adapters/resolve-import-run-status.js';

const mockGetApifyRunStatus = vi.mocked(getApifyRunStatus);
const mockGetApifyDatasetItems = vi.mocked(getApifyDatasetItems);
const mockMapAirbnbItem = vi.mocked(mapItemToRawExtraction);
const mockMapBookingItem = vi.mocked(mapApifyItemToRawExtraction);

describe('resolveImportRunStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('returns settled:false when the run status is RUNNING', async () => {
        mockGetApifyRunStatus.mockResolvedValue({ status: 'RUNNING', defaultDatasetId: 'ds-1' });

        const result = await resolveImportRunStatus({
            token: 'tok',
            runId: 'run-1',
            datasetId: 'ds-1',
            source: 'airbnb'
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
            source: 'airbnb'
        });

        expect(result).toEqual({ settled: false });
        expect(mockGetApifyDatasetItems).not.toHaveBeenCalled();
    });

    it('maps the first dataset item via the airbnb mapper on SUCCEEDED for source=airbnb', async () => {
        mockGetApifyRunStatus.mockResolvedValue({ status: 'SUCCEEDED', defaultDatasetId: 'ds-1' });
        const firstItem = { name: 'Cabaña del Río' };
        mockGetApifyDatasetItems.mockResolvedValue([firstItem, { name: 'ignored second item' }]);
        const raw = {
            sourcePlatform: 'airbnb' as const,
            name: { value: 'Cabaña del Río', source: 'official_api' as const }
        };
        mockMapAirbnbItem.mockReturnValue(raw);

        const result = await resolveImportRunStatus({
            token: 'tok',
            runId: 'run-1',
            datasetId: 'ds-1',
            source: 'airbnb'
        });

        expect(mockGetApifyDatasetItems).toHaveBeenCalledWith({ token: 'tok', datasetId: 'ds-1' });
        expect(mockMapAirbnbItem).toHaveBeenCalledWith(firstItem);
        expect(mockMapBookingItem).not.toHaveBeenCalled();
        expect(result).toEqual({ settled: true, raw });
    });

    it('maps the first dataset item via the booking mapper on SUCCEEDED for source=booking', async () => {
        mockGetApifyRunStatus.mockResolvedValue({ status: 'SUCCEEDED', defaultDatasetId: 'ds-2' });
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
            source: 'booking'
        });

        expect(mockMapBookingItem).toHaveBeenCalledWith(firstItem);
        expect(mockMapAirbnbItem).not.toHaveBeenCalled();
        expect(result).toEqual({ settled: true, raw });
    });

    it('returns nothing_found when SUCCEEDED but the dataset is empty', async () => {
        mockGetApifyRunStatus.mockResolvedValue({ status: 'SUCCEEDED', defaultDatasetId: 'ds-1' });
        mockGetApifyDatasetItems.mockResolvedValue([]);

        const result = await resolveImportRunStatus({
            token: 'tok',
            runId: 'run-1',
            datasetId: 'ds-1',
            source: 'airbnb'
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
            source: 'airbnb'
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
            source: 'airbnb'
        });

        expect(mockGetApifyDatasetItems).toHaveBeenCalledWith({
            token: 'tok',
            datasetId: 'ds-echoed-by-client'
        });
    });
});

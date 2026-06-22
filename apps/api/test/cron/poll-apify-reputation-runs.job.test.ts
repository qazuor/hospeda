/**
 * Poll Apify Reputation Runs Cron Job Tests (SPEC-250 Phase 6)
 *
 * Unit tests for the `poll-apify-reputation-runs` cron job handler.
 *
 * Mocked collaborators:
 * - `AccommodationExternalReputationModel.findPendingRuns` — returns PendingRunRow[]
 * - `AccommodationExternalReputationModel.upsertReputation` — write path
 * - `AccommodationExternalReputationModel.updateRunStatus` — write path
 * - `getApifyRunStatus` — Apify status HTTP call
 * - `getApifyDatasetItems` — Apify dataset fetch
 * - `getReputationAdapter` — returns adapter with `mapDatasetItems`
 * - `emptyReputationResult` — empty result helper
 * - `getReputationAdapterCredentials` — credentials
 *
 * Scenarios covered (AAA pattern):
 * 1. 0 pending rows → clean noop (processed:0, errors:0, success:true).
 * 2. SUCCEEDED run → items fetched, adapter mapped, reputation upserted (processed:1).
 * 3. FAILED run → error upsert, errors:1.
 * 4. ABORTED run → error upsert, errors:1.
 * 5. TIMED-OUT (Apify terminal) run → error upsert, errors:1.
 * 6. READY/RUNNING within timeout → updateRunStatus('running'), no counter change.
 * 7. READY/RUNNING already 'running' within timeout → no updateRunStatus call.
 * 8. READY/RUNNING past timeout → error upsert (timeout sweep), errors:1.
 * 9. getApifyRunStatus returns null → warn + skip (no upsert, no counter change).
 * 10. Adapter has no mapDatasetItems → falls back to emptyReputationResult.
 * 11. Per-row exception → logged, errors++, loop continues.
 *
 * @module test/cron/poll-apify-reputation-runs
 */

import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types.js';

// ---------------------------------------------------------------------------
// Hoisted mocks — must precede vi.mock() calls
// ---------------------------------------------------------------------------

const {
    mockFindPendingRuns,
    mockUpsertReputation,
    mockUpdateRunStatus,
    mockGetApifyRunStatus,
    mockGetApifyDatasetItems,
    mockGetReputationAdapter,
    mockMapDatasetItems,
    mockEmptyReputationResult,
    mockGetCredentials
} = vi.hoisted(() => {
    const mapDatasetItems = vi.fn().mockReturnValue({
        rating: 4.5,
        reviewsCount: 120,
        deepLink: 'https://booking.com/hotel/test',
        snippets: null,
        attributionUrl: null
    });

    return {
        mockFindPendingRuns: vi.fn().mockResolvedValue([]),
        mockUpsertReputation: vi.fn().mockResolvedValue({}),
        mockUpdateRunStatus: vi.fn().mockResolvedValue(undefined),
        mockGetApifyRunStatus: vi.fn().mockResolvedValue(null),
        mockGetApifyDatasetItems: vi.fn().mockResolvedValue([]),
        mockGetReputationAdapter: vi.fn().mockReturnValue({ mapDatasetItems }),
        mockMapDatasetItems: mapDatasetItems,
        mockEmptyReputationResult: vi.fn().mockReturnValue({
            rating: null,
            reviewsCount: null,
            deepLink: null,
            snippets: null,
            attributionUrl: null
        }),
        mockGetCredentials: vi.fn().mockReturnValue({
            apifyToken: 'test-apify-token',
            apifyBookingActor: 'apify/booking-scraper',
            apifyAirbnbActor: 'dtrungtin/airbnb-scraper',
            googlePlacesApiKey: 'google-key'
        })
    };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        AccommodationExternalReputationModel: vi.fn().mockImplementation(() => ({
            findPendingRuns: mockFindPendingRuns,
            upsertReputation: mockUpsertReputation,
            updateRunStatus: mockUpdateRunStatus
        }))
    };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        getApifyRunStatus: mockGetApifyRunStatus,
        getApifyDatasetItems: mockGetApifyDatasetItems,
        getReputationAdapter: mockGetReputationAdapter,
        emptyReputationResult: mockEmptyReputationResult
    };
});

vi.mock('../../src/utils/reputation-credentials.js', () => ({
    getReputationAdapterCredentials: mockGetCredentials
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Import under test — AFTER mocks are declared
// ---------------------------------------------------------------------------

import { pollApifyReputationRunsJob } from '../../src/cron/jobs/poll-apify-reputation-runs.job.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const ROW_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACC_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LISTING_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RUN_ID = 'apify-run-id-001';
const DATASET_ID = 'apify-dataset-id-001';
const LISTING_URL = 'https://booking.com/hotel/test-hotel';

/**
 * Builds a minimal PendingRunRow for test fixtures.
 */
function makePendingRow(
    overrides: Partial<{
        id: string;
        accommodationId: string;
        platform: string;
        listingId: string;
        apifyRunId: string | null;
        apifyDatasetId: string | null;
        runStatus: 'pending' | 'running';
        runStartedAt: Date | null;
        listingUrl: string;
    }> = {}
) {
    return {
        id: ROW_ID,
        accommodationId: ACC_ID,
        platform: 'BOOKING',
        listingId: LISTING_ID,
        apifyRunId: RUN_ID,
        apifyDatasetId: null,
        runStatus: 'pending' as const,
        runStartedAt: new Date('2026-06-20T10:00:00Z'),
        listingUrl: LISTING_URL,
        ...overrides
    };
}

/**
 * Builds a minimal CronJobContext for test execution.
 */
function makeCtx(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-06-20T10:05:00Z'),
        dryRun: false,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Poll Apify Reputation Runs Cron Job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset defaults.
        mockFindPendingRuns.mockResolvedValue([]);
        mockUpsertReputation.mockResolvedValue({});
        mockUpdateRunStatus.mockResolvedValue(undefined);
        mockGetApifyRunStatus.mockResolvedValue(null);
        mockGetApifyDatasetItems.mockResolvedValue([]);
        mockMapDatasetItems.mockReturnValue({
            rating: 4.5,
            reviewsCount: 120,
            deepLink: LISTING_URL,
            snippets: null,
            attributionUrl: null
        });
        mockGetReputationAdapter.mockReturnValue({ mapDatasetItems: mockMapDatasetItems });
        mockEmptyReputationResult.mockReturnValue({
            rating: null,
            reviewsCount: null,
            deepLink: null,
            snippets: null,
            attributionUrl: null
        });
        mockGetCredentials.mockReturnValue({
            apifyToken: 'test-apify-token',
            apifyBookingActor: 'apify/booking-scraper',
            apifyAirbnbActor: 'dtrungtin/airbnb-scraper',
            googlePlacesApiKey: 'google-key'
        });
        vi.unstubAllEnvs();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    // -------------------------------------------------------------------------
    // Job configuration
    // -------------------------------------------------------------------------

    describe('Job configuration', () => {
        it('has the expected name, schedule, and enabled flag', () => {
            expect(pollApifyReputationRunsJob.name).toBe('poll-apify-reputation-runs');
            expect(pollApifyReputationRunsJob.schedule).toBe('*/2 * * * *');
            expect(pollApifyReputationRunsJob.enabled).toBe(true);
            expect(pollApifyReputationRunsJob.timeoutMs).toBe(60_000);
            expect(typeof pollApifyReputationRunsJob.handler).toBe('function');
        });
    });

    // -------------------------------------------------------------------------
    // Scenario 1: 0 pending rows → clean noop
    // -------------------------------------------------------------------------

    describe('Handler — 0 pending rows', () => {
        it('returns success with processed:0 and errors:0 when no runs are pending', async () => {
            // Arrange
            mockFindPendingRuns.mockResolvedValue([]);

            // Act
            const result = await pollApifyReputationRunsJob.handler(makeCtx());

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(result.message).toContain('No pending runs');
            expect(mockGetApifyRunStatus).not.toHaveBeenCalled();
            expect(mockUpsertReputation).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Scenario 2: SUCCEEDED run → maps + upserts
    // -------------------------------------------------------------------------

    describe('Handler — SUCCEEDED run', () => {
        it('fetches dataset items, maps via adapter, upserts ok data, increments processed', async () => {
            // Arrange
            const row = makePendingRow({ runStatus: 'pending' });
            mockFindPendingRuns.mockResolvedValue([row]);
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'SUCCEEDED',
                defaultDatasetId: DATASET_ID
            });
            const mockItems = [{ reviews: 120, rating: 4.5 }];
            mockGetApifyDatasetItems.mockResolvedValue(mockItems);
            const expectedResult = {
                rating: 4.5,
                reviewsCount: 120,
                deepLink: LISTING_URL,
                snippets: null,
                attributionUrl: null
            };
            mockMapDatasetItems.mockReturnValue(expectedResult);

            // Act
            const result = await pollApifyReputationRunsJob.handler(makeCtx());

            // Assert
            expect(mockGetApifyRunStatus).toHaveBeenCalledWith({
                token: 'test-apify-token',
                runId: RUN_ID
            });
            expect(mockGetApifyDatasetItems).toHaveBeenCalledWith({
                token: 'test-apify-token',
                datasetId: DATASET_ID
            });
            expect(mockGetReputationAdapter).toHaveBeenCalledWith('BOOKING', expect.any(Object));
            expect(mockMapDatasetItems).toHaveBeenCalledWith(
                mockItems,
                expect.objectContaining({ url: LISTING_URL })
            );
            expect(mockUpsertReputation).toHaveBeenCalledWith(
                expect.objectContaining({
                    accommodationId: ACC_ID,
                    platform: 'BOOKING',
                    listingId: LISTING_ID,
                    rating: 4.5,
                    reviewsCount: 120,
                    fetchStatus: 'ok',
                    runStatus: 'idle',
                    apifyRunId: null,
                    apifyDatasetId: null
                })
            );
            expect(result.processed).toBe(1);
            expect(result.errors).toBe(0);
            expect(result.success).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // Scenario 3: FAILED run → error upsert
    // -------------------------------------------------------------------------

    describe('Handler — FAILED run', () => {
        it('upserts fetch_status=error and run_status=idle, increments errors', async () => {
            // Arrange
            const row = makePendingRow();
            mockFindPendingRuns.mockResolvedValue([row]);
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'FAILED',
                defaultDatasetId: DATASET_ID
            });

            // Act
            const result = await pollApifyReputationRunsJob.handler(makeCtx());

            // Assert
            expect(mockUpsertReputation).toHaveBeenCalledWith(
                expect.objectContaining({
                    fetchStatus: 'error',
                    fetchMessage: 'Apify run failed',
                    runStatus: 'idle',
                    apifyRunId: null,
                    apifyDatasetId: null
                })
            );
            expect(mockGetApifyDatasetItems).not.toHaveBeenCalled();
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(1);
            expect(result.success).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // Scenario 4: ABORTED run → error upsert
    // -------------------------------------------------------------------------

    describe('Handler — ABORTED run', () => {
        it('upserts fetch_status=error with aborted message', async () => {
            // Arrange
            const row = makePendingRow();
            mockFindPendingRuns.mockResolvedValue([row]);
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'ABORTED',
                defaultDatasetId: DATASET_ID
            });

            // Act
            const result = await pollApifyReputationRunsJob.handler(makeCtx());

            // Assert
            expect(mockUpsertReputation).toHaveBeenCalledWith(
                expect.objectContaining({
                    fetchStatus: 'error',
                    fetchMessage: 'Apify run aborted',
                    runStatus: 'idle',
                    apifyRunId: null
                })
            );
            expect(result.errors).toBe(1);
            expect(result.success).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // Scenario 5: TIMED-OUT (Apify terminal) → error upsert
    // -------------------------------------------------------------------------

    describe('Handler — TIMED-OUT run (Apify terminal)', () => {
        it('upserts fetch_status=error with timed-out message', async () => {
            // Arrange
            const row = makePendingRow();
            mockFindPendingRuns.mockResolvedValue([row]);
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'TIMED-OUT',
                defaultDatasetId: DATASET_ID
            });

            // Act
            const result = await pollApifyReputationRunsJob.handler(makeCtx());

            // Assert
            expect(mockUpsertReputation).toHaveBeenCalledWith(
                expect.objectContaining({
                    fetchStatus: 'error',
                    fetchMessage: 'Apify run timed-out',
                    runStatus: 'idle',
                    apifyRunId: null
                })
            );
            expect(result.errors).toBe(1);
        });
    });

    // -------------------------------------------------------------------------
    // Scenario 6: READY/RUNNING within timeout → updateRunStatus('running')
    // -------------------------------------------------------------------------

    describe('Handler — RUNNING within timeout', () => {
        it('calls updateRunStatus with running when row is still pending and within timeout', async () => {
            // Arrange: started 1 min ago, timeout is 10 min → still within window
            const runStartedAt = new Date(Date.now() - 60_000);
            const row = makePendingRow({ runStatus: 'pending', runStartedAt });
            mockFindPendingRuns.mockResolvedValue([row]);
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'RUNNING',
                defaultDatasetId: DATASET_ID
            });

            // Act
            const result = await pollApifyReputationRunsJob.handler(makeCtx());

            // Assert
            expect(mockUpdateRunStatus).toHaveBeenCalledWith({
                id: ROW_ID,
                status: 'running'
            });
            expect(mockUpsertReputation).not.toHaveBeenCalled();
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(result.success).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // Scenario 7: Already 'running' within timeout → no updateRunStatus call
    // -------------------------------------------------------------------------

    describe('Handler — already running within timeout', () => {
        it('does not call updateRunStatus when row is already running and within timeout', async () => {
            // Arrange: row already has runStatus='running'
            const runStartedAt = new Date(Date.now() - 60_000);
            const row = makePendingRow({ runStatus: 'running', runStartedAt });
            mockFindPendingRuns.mockResolvedValue([row]);
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'RUNNING',
                defaultDatasetId: DATASET_ID
            });

            // Act
            const result = await pollApifyReputationRunsJob.handler(makeCtx());

            // Assert
            expect(mockUpdateRunStatus).not.toHaveBeenCalled();
            expect(mockUpsertReputation).not.toHaveBeenCalled();
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // Scenario 8: READY/RUNNING past timeout → error upsert (timeout sweep)
    // -------------------------------------------------------------------------

    describe('Handler — RUNNING past timeout (timeout sweep)', () => {
        it('upserts fetch_status=error when run age exceeds configured timeout', async () => {
            // Arrange: configure 5-second timeout, run started 10 s ago → timed out
            vi.stubEnv('HOSPEDA_EXTREP_APIFY_RUN_TIMEOUT_MS', '5000');
            const runStartedAt = new Date(Date.now() - 10_000);
            const row = makePendingRow({ runStatus: 'running', runStartedAt });
            mockFindPendingRuns.mockResolvedValue([row]);
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'RUNNING',
                defaultDatasetId: DATASET_ID
            });

            // Act
            const result = await pollApifyReputationRunsJob.handler(makeCtx());

            // Assert
            expect(mockUpsertReputation).toHaveBeenCalledWith(
                expect.objectContaining({
                    fetchStatus: 'error',
                    fetchMessage: 'Apify run timed out',
                    runStatus: 'idle',
                    apifyRunId: null
                })
            );
            expect(mockUpdateRunStatus).not.toHaveBeenCalled();
            expect(result.errors).toBe(1);
            expect(result.success).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // Scenario 9: getApifyRunStatus returns null → skip/continue
    // -------------------------------------------------------------------------

    describe('Handler — getApifyRunStatus returns null', () => {
        it('warns and skips the row without incrementing any counter', async () => {
            // Arrange
            const row = makePendingRow();
            mockFindPendingRuns.mockResolvedValue([row]);
            mockGetApifyRunStatus.mockResolvedValue(null);

            const ctx = makeCtx();

            // Act
            const result = await pollApifyReputationRunsJob.handler(ctx);

            // Assert
            expect(mockUpsertReputation).not.toHaveBeenCalled();
            expect(mockUpdateRunStatus).not.toHaveBeenCalled();
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(result.success).toBe(true);
            expect(ctx.logger.warn as Mock).toHaveBeenCalledWith(
                expect.stringContaining('Could not get Apify run status'),
                expect.any(Object)
            );
        });
    });

    // -------------------------------------------------------------------------
    // Scenario 10: Adapter has no mapDatasetItems → falls back to emptyReputationResult
    // -------------------------------------------------------------------------

    describe('Handler — adapter without mapDatasetItems', () => {
        it('falls back to emptyReputationResult when the adapter does not implement mapDatasetItems', async () => {
            // Arrange: adapter without mapDatasetItems (e.g. Google)
            mockGetReputationAdapter.mockReturnValue({ fetch: vi.fn() }); // no mapDatasetItems
            const row = makePendingRow({ runStatus: 'pending' });
            mockFindPendingRuns.mockResolvedValue([row]);
            mockGetApifyRunStatus.mockResolvedValue({
                status: 'SUCCEEDED',
                defaultDatasetId: DATASET_ID
            });

            // Act
            const result = await pollApifyReputationRunsJob.handler(makeCtx());

            // Assert
            expect(mockEmptyReputationResult).toHaveBeenCalled();
            expect(mockUpsertReputation).toHaveBeenCalledWith(
                expect.objectContaining({
                    fetchStatus: 'ok',
                    runStatus: 'idle',
                    rating: null,
                    reviewsCount: null
                })
            );
            expect(result.processed).toBe(1);
        });
    });

    // -------------------------------------------------------------------------
    // Scenario 11: Per-row exception → logged, errors++, loop continues
    // -------------------------------------------------------------------------

    describe('Handler — per-row exception', () => {
        it('catches a per-row error, increments errors, and continues processing subsequent rows', async () => {
            // Arrange: first row throws, second row succeeds
            const rowA = makePendingRow({ id: 'row-a', apifyRunId: 'run-a' });
            const rowB = makePendingRow({
                id: 'row-b',
                apifyRunId: 'run-b',
                accommodationId: 'acc-b'
            });
            mockFindPendingRuns.mockResolvedValue([rowA, rowB]);

            mockGetApifyRunStatus
                .mockRejectedValueOnce(new Error('Network timeout'))
                .mockResolvedValueOnce({ status: 'SUCCEEDED', defaultDatasetId: DATASET_ID });

            mockGetApifyDatasetItems.mockResolvedValue([]);

            // Act
            const result = await pollApifyReputationRunsJob.handler(makeCtx());

            // Assert
            expect(result.errors).toBe(1);
            expect(result.processed).toBe(1);
            expect(result.success).toBe(false);
            // Second row must have been upserted despite the first throwing.
            expect(mockUpsertReputation).toHaveBeenCalledWith(
                expect.objectContaining({ accommodationId: 'acc-b' })
            );
        });
    });
});

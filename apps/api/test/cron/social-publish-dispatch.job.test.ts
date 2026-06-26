/**
 * Social Publish Dispatch Cron Job Tests
 *
 * Mocking strategy:
 * - `@repo/service-core` → SocialPublishDispatchService (findEligibleTargets + dispatchTarget)
 * - `@repo/db` → withTransaction (advisory lock guard) + sql tag
 * - `../../src/utils/env.js` → env (HOSPEDA_MAKE_API_KEY, HOSPEDA_API_URL)
 * - `../../src/utils/logger.js` → apiLogger (lock-skip warn assertions)
 *
 * @module test/cron/social-publish-dispatch
 * @see SPEC-254 T-049
 */

import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types.js';

// ---------------------------------------------------------------------------
// Hoisted: advisory-lock transaction stub
// ---------------------------------------------------------------------------

const { mockWithTransaction, _mockTx, mockFindEligibleTargets, mockDispatchTarget } = vi.hoisted(
    () => {
        const tx = {
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
        };
        const withTx = vi.fn(async <T>(callback: (innerTx: typeof tx) => Promise<T>) =>
            callback(tx)
        );

        const findEligibleTargets = vi.fn().mockResolvedValue({ targets: [] });
        const dispatchTarget = vi.fn().mockResolvedValue({ outcome: 'dispatched' });

        return {
            mockWithTransaction: withTx,
            _mockTx: tx,
            mockFindEligibleTargets: findEligibleTargets,
            mockDispatchTarget: dispatchTarget
        };
    }
);

// ---------------------------------------------------------------------------
// Module mocks (must appear before any import of the module under test)
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/env.js', () => ({
    env: {
        HOSPEDA_MAKE_API_KEY: 'test-make-api-key',
        HOSPEDA_API_URL: 'https://api.test.hospeda.com.ar'
    }
}));

vi.mock('@repo/db', () => ({
    withTransaction: mockWithTransaction,
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        __sql: true,
        strings,
        values
    }))
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('@repo/service-core', () => ({
    SocialPublishDispatchService: vi.fn().mockImplementation(() => ({
        findEligibleTargets: mockFindEligibleTargets,
        dispatchTarget: mockDispatchTarget
    }))
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are wired
// ---------------------------------------------------------------------------

import { socialPublishDispatchJob } from '../../src/cron/jobs/social-publish-dispatch.job.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal EligibleTarget stub — only needs target+post shapes. */
const makeTarget = (id: string) => ({
    target: { id, status: 'APPROVED' },
    post: { id: `post-${id}`, status: 'READY' }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Social Publish Dispatch Cron Job', () => {
    let mockLogger: { info: Mock; warn: Mock; error: Mock; debug: Mock };
    let mockContext: CronJobContext;

    beforeEach(() => {
        mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
        mockContext = {
            logger: mockLogger,
            startedAt: new Date('2026-06-22T10:00:00Z'),
            dryRun: false
        };
        // Default: advisory lock acquired, no targets
        _mockTx.execute.mockResolvedValue({ rows: [{ acquired: true }] });
        mockFindEligibleTargets.mockResolvedValue({ targets: [] });
        mockDispatchTarget.mockResolvedValue({ outcome: 'dispatched' });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------------

    describe('Job Configuration', () => {
        it('has the expected name and schedule', () => {
            expect(socialPublishDispatchJob.name).toBe('social-publish-dispatch');
            expect(socialPublishDispatchJob.schedule).toBe('*/5 * * * *');
            expect(socialPublishDispatchJob.enabled).toBe(true);
            expect(socialPublishDispatchJob.timeoutMs).toBe(120_000);
            expect(typeof socialPublishDispatchJob.handler).toBe('function');
        });
    });

    // -----------------------------------------------------------------------
    // Missing-API-key guard
    // -----------------------------------------------------------------------

    describe('Missing HOSPEDA_MAKE_API_KEY guard', () => {
        it('returns success with processed=0 when HOSPEDA_MAKE_API_KEY is absent', async () => {
            // Arrange: temporarily replace env mock with missing key.
            // Cast via `unknown` to widen to a mutable record without using `any`.
            const { env } = await import('../../src/utils/env.js');
            const envRecord = env as unknown as Record<string, string | undefined>;
            const originalKey = envRecord.HOSPEDA_MAKE_API_KEY;
            envRecord.HOSPEDA_MAKE_API_KEY = undefined;

            // Act
            const result = await socialPublishDispatchJob.handler(mockContext);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(result.message).toContain('HOSPEDA_MAKE_API_KEY is not configured');
            expect(result.details).toMatchObject({
                skipped: true,
                reason: 'missing_make_api_key'
            });
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('HOSPEDA_MAKE_API_KEY is not set')
            );
            // dispatchTarget must NOT have been called
            expect(mockDispatchTarget).not.toHaveBeenCalled();

            // Restore
            envRecord.HOSPEDA_MAKE_API_KEY = originalKey;
        });

        it('does not call withTransaction when the API key is missing', async () => {
            const { env } = await import('../../src/utils/env.js');
            const envRecord = env as unknown as Record<string, string | undefined>;
            const originalKey = envRecord.HOSPEDA_MAKE_API_KEY;
            envRecord.HOSPEDA_MAKE_API_KEY = undefined;

            await socialPublishDispatchJob.handler(mockContext);

            expect(mockWithTransaction).not.toHaveBeenCalled();

            envRecord.HOSPEDA_MAKE_API_KEY = originalKey;
        });
    });

    // -----------------------------------------------------------------------
    // Advisory lock
    // -----------------------------------------------------------------------

    describe('Advisory lock', () => {
        it('skips without dispatching when the lock is not acquired', async () => {
            vi.mocked(mockWithTransaction).mockImplementationOnce(
                async (callback: (tx: typeof _mockTx) => Promise<unknown>) => {
                    const txStub = {
                        execute: vi.fn().mockResolvedValueOnce({ rows: [{ acquired: false }] })
                    };
                    return callback(txStub);
                }
            );

            const result = await socialPublishDispatchJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.message).toContain('advisory lock not acquired');
            expect(result.details).toMatchObject({ skipped: true, reason: 'lock_not_acquired' });
            expect(mockFindEligibleTargets).not.toHaveBeenCalled();
            expect(mockDispatchTarget).not.toHaveBeenCalled();
        });

        it('logs a warning when the advisory lock is not acquired', async () => {
            vi.mocked(mockWithTransaction).mockImplementationOnce(
                async (callback: (tx: typeof _mockTx) => Promise<unknown>) => {
                    const txStub = {
                        execute: vi.fn().mockResolvedValueOnce({ rows: [{ acquired: false }] })
                    };
                    return callback(txStub);
                }
            );
            const { apiLogger } = await import('../../src/utils/logger.js');

            await socialPublishDispatchJob.handler(mockContext);

            expect(apiLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('previous run still holds advisory lock')
            );
        });
    });

    // -----------------------------------------------------------------------
    // Dry-run mode
    // -----------------------------------------------------------------------

    describe('Dry-run mode', () => {
        it('reports eligible count without calling dispatchTarget', async () => {
            mockFindEligibleTargets.mockResolvedValue({
                targets: [makeTarget('t1'), makeTarget('t2')]
            });

            const result = await socialPublishDispatchJob.handler({
                ...mockContext,
                dryRun: true
            });

            expect(result.success).toBe(true);
            expect(result.processed).toBe(2);
            expect(result.errors).toBe(0);
            expect(result.message).toContain('2 target(s) eligible');
            expect(result.details?.dryRun).toBe(true);
            expect(result.details?.eligibleCount).toBe(2);
            expect(mockDispatchTarget).not.toHaveBeenCalled();
        });

        it('succeeds with processed=0 when no eligible targets in dry-run', async () => {
            mockFindEligibleTargets.mockResolvedValue({ targets: [] });

            const result = await socialPublishDispatchJob.handler({
                ...mockContext,
                dryRun: true
            });

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(mockDispatchTarget).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Production dispatch loop
    // -----------------------------------------------------------------------

    describe('Production dispatch loop', () => {
        it('dispatches each eligible target with makeApiKey and apiBaseUrl', async () => {
            const targets = [makeTarget('t1'), makeTarget('t2'), makeTarget('t3')];
            mockFindEligibleTargets.mockResolvedValue({ targets });
            mockDispatchTarget.mockResolvedValue({ outcome: 'dispatched' });

            const result = await socialPublishDispatchJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(3);
            expect(result.errors).toBe(0);
            expect(mockDispatchTarget).toHaveBeenCalledTimes(3);

            // Every call must receive the env-sourced makeApiKey
            // (apiBaseUrl removed in SPEC-254 dispatch redesign — Make webhook
            // response is now synchronous so no callback URL is needed)
            for (const call of vi.mocked(mockDispatchTarget).mock.calls) {
                expect(call[0]).toMatchObject({
                    makeApiKey: 'test-make-api-key'
                });
            }
        });

        it('tallies outcomes from dispatchTarget in details', async () => {
            const targets = [makeTarget('t1'), makeTarget('t2'), makeTarget('t3')];
            mockFindEligibleTargets.mockResolvedValue({ targets });
            mockDispatchTarget
                .mockResolvedValueOnce({ outcome: 'dispatched' })
                .mockResolvedValueOnce({ outcome: 'retry_scheduled', retryCount: 1 })
                .mockResolvedValueOnce({ outcome: 'skipped_no_webhook' });

            const result = await socialPublishDispatchJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(3);
            expect(result.errors).toBe(0);
            const outcomes = result.details?.outcomes as Record<string, number>;
            expect(outcomes?.dispatched).toBe(1);
            expect(outcomes?.retry_scheduled).toBe(1);
            expect(outcomes?.skipped_no_webhook).toBe(1);
        });

        it('counts exhausted outcomes as errors', async () => {
            const targets = [makeTarget('t1'), makeTarget('t2')];
            mockFindEligibleTargets.mockResolvedValue({ targets });
            mockDispatchTarget
                .mockResolvedValueOnce({ outcome: 'dispatched' })
                .mockResolvedValueOnce({ outcome: 'exhausted' });

            const result = await socialPublishDispatchJob.handler(mockContext);

            expect(result.success).toBe(false);
            expect(result.errors).toBe(1);
            expect(result.processed).toBe(2);
        });

        it('continues the batch after a per-target thrown error and tallies it', async () => {
            const targets = [makeTarget('t1'), makeTarget('t2'), makeTarget('t3')];
            mockFindEligibleTargets.mockResolvedValue({ targets });
            mockDispatchTarget
                .mockResolvedValueOnce({ outcome: 'dispatched' })
                .mockRejectedValueOnce(new Error('network timeout'))
                .mockResolvedValueOnce({ outcome: 'dispatched' });

            const result = await socialPublishDispatchJob.handler(mockContext);

            // All three targets attempted
            expect(mockDispatchTarget).toHaveBeenCalledTimes(3);
            expect(result.processed).toBe(3);
            // One errored target
            expect(result.errors).toBe(1);
            expect(result.success).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to dispatch target'),
                expect.objectContaining({ error: 'network timeout' })
            );
        });

        it('succeeds with processed=0 when there are no eligible targets', async () => {
            mockFindEligibleTargets.mockResolvedValue({ targets: [] });

            const result = await socialPublishDispatchJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(mockDispatchTarget).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Outer error handling
    // -----------------------------------------------------------------------

    describe('Outer error handling', () => {
        it('catches an unhandled findEligibleTargets error and returns success=false', async () => {
            mockFindEligibleTargets.mockRejectedValueOnce(new Error('DB connection lost'));

            const result = await socialPublishDispatchJob.handler(mockContext);

            expect(result.success).toBe(false);
            expect(result.errors).toBe(1);
            expect(result.message).toContain('Failed to run social publish dispatch');
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Social publish dispatch failed',
                expect.objectContaining({ error: 'DB connection lost' })
            );
        });
    });
});

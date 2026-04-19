/**
 * Unit Tests: Media Orphan Cleanup Cron Job Handler
 *
 * Tests the media-orphan-cleanup job that wipes Cloudinary's
 * `hospeda/preview/` and `hospeda/test/` prefixes weekly.
 *
 * Test Coverage:
 *   - Job definition metadata (name, schedule, enabled, timeoutMs)
 *   - Calls deleteByPrefix on both ORPHAN_PREFIXES in order
 *   - Returns success: true with processed count when both succeed
 *   - Returns success: false with errors > 0 when one prefix fails
 *   - Skips work in production environment (NODE_ENV guard)
 *   - Skips work when media provider is not configured
 *   - Honors dry run mode (no deleteByPrefix invocation)
 *
 * SPEC-078-GAPS GAP-078-231.
 *
 * @module test/cron/media-orphan-cleanup
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetMediaProvider, mockDeleteByPrefix } = vi.hoisted(() => ({
    mockGetMediaProvider: vi.fn(),
    mockDeleteByPrefix: vi.fn()
}));

vi.mock('../../src/services/media', () => ({
    getMediaProvider: mockGetMediaProvider
}));

// Env mock — must allow swapping NODE_ENV between tests.
let nodeEnv: 'development' | 'test' | 'production' = 'test';
vi.mock('../../src/utils/env', () => ({
    env: new Proxy(
        {},
        {
            get: (_target, prop) => {
                if (prop === 'NODE_ENV') {
                    return nodeEnv;
                }
                return undefined;
            }
        }
    )
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createCtx = (overrides: Partial<CronJobContext> = {}): CronJobContext => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    },
    startedAt: new Date('2026-04-19T00:00:00Z'),
    dryRun: false,
    ...overrides
});

const PREVIEW_PREFIX = 'hospeda/preview/';
const TEST_PREFIX = 'hospeda/test/';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mediaOrphanCleanupJob — SPEC-078-GAPS GAP-078-231', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        nodeEnv = 'test';
        mockDeleteByPrefix.mockResolvedValue(undefined);
        mockGetMediaProvider.mockReturnValue({
            upload: vi.fn(),
            delete: vi.fn(),
            deleteByPrefix: mockDeleteByPrefix,
            healthCheck: vi.fn()
        });
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('definition', () => {
        it('exposes the expected metadata', async () => {
            // Arrange + Act
            const { mediaOrphanCleanupJob } = await import(
                '../../src/cron/jobs/media-orphan-cleanup.job'
            );

            // Assert
            expect(mediaOrphanCleanupJob.name).toBe('media-orphan-cleanup');
            expect(mediaOrphanCleanupJob.schedule).toBe('0 0 * * 0');
            expect(mediaOrphanCleanupJob.enabled).toBe(true);
            expect(mediaOrphanCleanupJob.timeoutMs).toBe(60_000);
            expect(typeof mediaOrphanCleanupJob.handler).toBe('function');
        });
    });

    describe('handler — happy path', () => {
        it('calls deleteByPrefix on both orphan prefixes', async () => {
            // Arrange
            const { mediaOrphanCleanupJob } = await import(
                '../../src/cron/jobs/media-orphan-cleanup.job'
            );

            // Act
            const result = await mediaOrphanCleanupJob.handler(createCtx());

            // Assert
            expect(mockDeleteByPrefix).toHaveBeenCalledTimes(2);
            expect(mockDeleteByPrefix).toHaveBeenNthCalledWith(1, { prefix: PREVIEW_PREFIX });
            expect(mockDeleteByPrefix).toHaveBeenNthCalledWith(2, { prefix: TEST_PREFIX });
            expect(result.success).toBe(true);
            expect(result.processed).toBe(2);
            expect(result.errors).toBe(0);
        });
    });

    describe('handler — failure', () => {
        it('returns success: false when one prefix deletion throws', async () => {
            // Arrange
            const { mediaOrphanCleanupJob } = await import(
                '../../src/cron/jobs/media-orphan-cleanup.job'
            );
            mockDeleteByPrefix
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('Cloudinary 500'));

            // Act
            const result = await mediaOrphanCleanupJob.handler(createCtx());

            // Assert
            expect(result.success).toBe(false);
            expect(result.processed).toBe(1);
            expect(result.errors).toBe(1);
            expect(result.message).toContain('1 failure');
            expect(result.details?.failures).toEqual([
                { prefix: TEST_PREFIX, error: 'Cloudinary 500' }
            ]);
        });
    });

    describe('handler — production guard', () => {
        it('short-circuits when NODE_ENV is production', async () => {
            // Arrange
            nodeEnv = 'production';
            const { mediaOrphanCleanupJob } = await import(
                '../../src/cron/jobs/media-orphan-cleanup.job'
            );

            // Act
            const result = await mediaOrphanCleanupJob.handler(createCtx());

            // Assert
            expect(mockGetMediaProvider).not.toHaveBeenCalled();
            expect(mockDeleteByPrefix).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.details?.skipped).toBe(true);
            expect(result.details?.reason).toBe('production');
        });
    });

    describe('handler — provider not configured', () => {
        it('skips when getMediaProvider returns null', async () => {
            // Arrange
            mockGetMediaProvider.mockReturnValue(null);
            const { mediaOrphanCleanupJob } = await import(
                '../../src/cron/jobs/media-orphan-cleanup.job'
            );

            // Act
            const result = await mediaOrphanCleanupJob.handler(createCtx());

            // Assert
            expect(mockDeleteByPrefix).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.details?.reason).toBe('no-provider');
        });
    });

    describe('handler — dry run', () => {
        it('does not call deleteByPrefix in dry run mode', async () => {
            // Arrange
            const { mediaOrphanCleanupJob } = await import(
                '../../src/cron/jobs/media-orphan-cleanup.job'
            );

            // Act
            const result = await mediaOrphanCleanupJob.handler(createCtx({ dryRun: true }));

            // Assert
            expect(mockDeleteByPrefix).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.details?.dryRun).toBe(true);
        });
    });
});

/**
 * session-recording-retention cron (HOS-2347): manifest entry and file name, it
 * reads the configured period and runs even with the recording switch OFF, it
 * skips with a warning when the Umami DB is not configured, and it reports
 * failures instead of throwing.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockRetention, mockIsEnabled, mockPurge, mockEnv } = vi.hoisted(() => ({
    mockRetention: vi.fn(),
    mockIsEnabled: vi.fn(),
    mockPurge: vi.fn(),
    mockEnv: { NODE_ENV: 'development' as string }
}));

vi.mock('../../src/utils/env.js', () => ({ env: mockEnv }));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    PlatformSettingsService: class {
        getSessionRecordingRetentionDays = mockRetention;
        isSessionRecordingEnabled = mockIsEnabled;
    }
}));

vi.mock('../../src/services/session-recording-purge.js', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    purgeSessionRecordingsFromEnv: mockPurge
}));

import { sessionRecordingRetentionJob } from '../../src/cron/jobs/session-recording-retention.job';
import { cronJobs } from '../../src/cron/registry';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

function makeContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-11-18T07:25:00.000Z'),
        runId: 'run-test',
        correlationId: '00000000-0000-4000-8000-00000000c0de',
        dryRun: false,
        ...overrides
    };
}

describe('sessionRecordingRetentionJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv.NODE_ENV = 'development';
    });

    it('is in the manifest and the registry with the same schedule, in a file named after it', () => {
        const entry = CRON_SCHEDULES.find((job) => job.name === 'session-recording-retention');

        expect(sessionRecordingRetentionJob.name).toBe('session-recording-retention');
        expect(entry?.schedule).toBe(sessionRecordingRetentionJob.schedule);
        expect(entry?.category).toBe('system');
        expect(cronJobs).toContain(sessionRecordingRetentionJob);
        expect(sessionRecordingRetentionJob.enabled).toBe(true);
        expect(
            existsSync(resolve(__dirname, '../../src/cron/jobs/session-recording-retention.job.ts'))
        ).toBe(true);
    });

    it('purges with the configured period and runs even when the switch is OFF', async () => {
        // Arrange
        mockIsEnabled.mockResolvedValue(false);
        mockRetention.mockResolvedValue(14);
        mockPurge.mockResolvedValue({
            status: 'purged',
            replaysDeleted: 4,
            heatmapEventsDeleted: 6,
            savedReplaysDeleted: 2,
            stoppedEarly: false
        });

        // Act
        const result = await sessionRecordingRetentionJob.handler(makeContext());

        // Assert
        expect(mockPurge).toHaveBeenCalledWith({ retentionDays: 14 });
        expect(mockIsEnabled).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.processed).toBe(12);
        expect(result.details).toMatchObject({
            retentionDays: 14,
            replaysDeleted: 4,
            heatmapEventsDeleted: 6
        });
    });

    it('hands the run signal to the purge', async () => {
        // Arrange
        const controller = new AbortController();
        mockRetention.mockResolvedValue(30);
        mockPurge.mockResolvedValue({
            status: 'purged',
            replaysDeleted: 0,
            heatmapEventsDeleted: 0,
            savedReplaysDeleted: 0,
            stoppedEarly: true
        });

        // Act
        const result = await sessionRecordingRetentionJob.handler(
            makeContext({ signal: controller.signal })
        );

        // Assert
        expect(mockPurge).toHaveBeenCalledWith({ retentionDays: 30, signal: controller.signal });
        expect(result.details).toMatchObject({ stoppedEarly: true });
    });

    it('outside production, logs a warning and skips without failing when the Umami DB URL is unset', async () => {
        // Arrange
        const ctx = makeContext();
        mockRetention.mockResolvedValue(30);
        mockPurge.mockResolvedValue({ status: 'skipped', reason: 'DATABASE_URL_UNSET' });

        // Act
        const result = await sessionRecordingRetentionJob.handler(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.errors).toBe(0);
        expect(result.processed).toBe(0);
        expect(result.details).toMatchObject({ skipped: true, reason: 'DATABASE_URL_UNSET' });
        expect(ctx.logger.warn).toHaveBeenCalledTimes(1);
    });

    it('in production, an unset Umami DB URL fails the run so it shows red', async () => {
        // Arrange
        mockEnv.NODE_ENV = 'production';
        const ctx = makeContext();
        mockRetention.mockResolvedValue(30);
        mockPurge.mockResolvedValue({ status: 'skipped', reason: 'DATABASE_URL_UNSET' });

        // Act
        const result = await sessionRecordingRetentionJob.handler(ctx);

        // Assert
        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.message).toContain('HOSPEDA_UMAMI_DATABASE_URL');
        expect(ctx.logger.error).toHaveBeenCalledTimes(1);
    });

    it('skips with a log, without failing, when another purge holds the lock', async () => {
        // Arrange
        mockEnv.NODE_ENV = 'production';
        const ctx = makeContext();
        mockRetention.mockResolvedValue(30);
        mockPurge.mockResolvedValue({ status: 'locked' });

        // Act
        const result = await sessionRecordingRetentionJob.handler(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.details).toMatchObject({ skipped: true, reason: 'LOCKED' });
        expect(ctx.logger.info).toHaveBeenCalledTimes(1);
    });

    it('a dry run deletes nothing and reads nothing', async () => {
        const result = await sessionRecordingRetentionJob.handler(makeContext({ dryRun: true }));

        expect(mockPurge).not.toHaveBeenCalled();
        expect(mockRetention).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
    });

    it('reports a failure instead of throwing', async () => {
        mockRetention.mockResolvedValue(30);
        mockPurge.mockRejectedValue(new Error('connection refused'));

        const result = await sessionRecordingRetentionJob.handler(makeContext());

        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
    });
});

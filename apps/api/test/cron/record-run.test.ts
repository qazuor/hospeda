import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Hoisted mock for the service's recordRun so test bodies can drive it. */
const { mockRecordRun } = vi.hoisted(() => ({ mockRecordRun: vi.fn() }));
const { mockCaptureException } = vi.hoisted(() => ({ mockCaptureException: vi.fn() }));

// Intercept `new CronRunService(...)` created at module load in record-run.ts.
vi.mock('@repo/service-core', () => ({
    CronRunService: vi.fn(() => ({ recordRun: mockRecordRun }))
}));

vi.mock('@sentry/node', () => ({ captureException: mockCaptureException }));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { recordCronRun } from '../../src/cron/record-run';

describe('recordCronRun', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRecordRun.mockResolvedValue(undefined);
    });

    it('records a successful result as status=success with the processed count', async () => {
        await recordCronRun({
            jobName: 'dunning',
            executionMode: 'scheduled',
            dryRun: false,
            startedAt: new Date('2026-05-29T06:00:00.000Z'),
            finishedAt: new Date('2026-05-29T06:00:02.000Z'),
            result: { success: true, message: 'ok', processed: 5, errors: 0, durationMs: 2000 }
        });

        const { data } = mockRecordRun.mock.calls[0]?.[0] as { data: Record<string, unknown> };
        expect(data.status).toBe('success');
        expect(data.processed).toBe(5);
        expect(data.durationMs).toBe(2000);
        expect(data.executionMode).toBe('scheduled');
    });

    it('records a result with success=false as status=failed', async () => {
        await recordCronRun({
            jobName: 'dunning',
            executionMode: 'scheduled',
            dryRun: false,
            startedAt: new Date(),
            result: { success: false, message: 'partial', processed: 1, errors: 2, durationMs: 10 }
        });

        const { data } = mockRecordRun.mock.calls[0]?.[0] as { data: Record<string, unknown> };
        expect(data.status).toBe('failed');
        expect(data.errors).toBe(2);
    });

    it('maps a timeout error to status=timeout', async () => {
        await recordCronRun({
            jobName: 'dunning',
            executionMode: 'manual',
            dryRun: false,
            startedAt: new Date(),
            error: new Error('Job execution timeout after 30000ms')
        });

        const { data } = mockRecordRun.mock.calls[0]?.[0] as { data: Record<string, unknown> };
        expect(data.status).toBe('timeout');
        expect(data.errorMessage).toContain('timeout');
    });

    it('maps a generic error to status=failed and captures the message', async () => {
        await recordCronRun({
            jobName: 'dunning',
            executionMode: 'manual',
            dryRun: true,
            startedAt: new Date(),
            error: new Error('boom')
        });

        const { data } = mockRecordRun.mock.calls[0]?.[0] as { data: Record<string, unknown> };
        expect(data.status).toBe('failed');
        expect(data.errorMessage).toBe('boom');
        expect(data.dryRun).toBe(true);
    });

    it('NEVER throws when the service insert rejects (fire-and-forget)', async () => {
        mockRecordRun.mockRejectedValue(new Error('DB unavailable'));

        await expect(
            recordCronRun({
                jobName: 'dunning',
                executionMode: 'scheduled',
                dryRun: false,
                startedAt: new Date(),
                result: { success: true, message: 'ok', processed: 0, errors: 0, durationMs: 1 }
            })
        ).resolves.toBeUndefined();

        expect(mockCaptureException).toHaveBeenCalledTimes(1);
    });
});

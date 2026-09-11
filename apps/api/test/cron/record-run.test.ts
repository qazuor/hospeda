import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Hoisted mock for the service's recordRun so test bodies can drive it. */
const { mockRecordRun } = vi.hoisted(() => ({ mockRecordRun: vi.fn() }));
const { mockCaptureException } = vi.hoisted(() => ({ mockCaptureException: vi.fn() }));

// Intercept `new CronRunService(...)` created at module load in record-run.ts.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        CronRunService: vi.fn(function () {
            return { recordRun: mockRecordRun };
        })
    };
});

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
            result: {
                success: false,
                message: 'dunning failed hard',
                processed: 1,
                errors: 2,
                durationMs: 10
            }
        });

        const { data } = mockRecordRun.mock.calls[0]?.[0] as { data: Record<string, unknown> };
        expect(data.status).toBe('failed');
        expect(data.errors).toBe(2);
    });

    // HOS-918 regression: `errorMessage` was dropped for a non-thrown failure, so
    // 45 production `failed` rows have `error_message = NULL` with nothing to
    // investigate. A `success: false` result (no exception) must persist the job's
    // own `message` as `errorMessage` instead of leaving it `null`.
    it('persists result.message as errorMessage when success=false without a thrown error', async () => {
        await recordCronRun({
            jobName: 'dunning',
            executionMode: 'scheduled',
            dryRun: false,
            startedAt: new Date(),
            result: {
                success: false,
                message: 'dunning failed hard',
                processed: 1,
                errors: 2,
                durationMs: 10
            }
        });

        const { data } = mockRecordRun.mock.calls[0]?.[0] as { data: Record<string, unknown> };
        expect(data.errorMessage).toBe('dunning failed hard');
    });

    // HOS-918 regression: page-revalidation.job.ts returns `success: true` with
    // `errors: 1` for a soft failure (purge failed but the job kept going). Before
    // this fix, `record-run.ts` derived status purely from `result.success`, so this
    // was persisted as `success` — indistinguishable from a clean run. Must be
    // `partial`, and the job's message must be persisted so it can be investigated.
    it('records a result with success=true and errors>0 as status=partial, with errorMessage set', async () => {
        await recordCronRun({
            jobName: 'page-revalidation',
            executionMode: 'scheduled',
            dryRun: false,
            startedAt: new Date(),
            result: {
                success: true,
                message: 'Revalidated 2 entity types (1 errors)',
                processed: 2,
                errors: 1,
                durationMs: 100
            }
        });

        const { data } = mockRecordRun.mock.calls[0]?.[0] as { data: Record<string, unknown> };
        expect(data.status).toBe('partial');
        expect(data.errorMessage).toBe('Revalidated 2 entity types (1 errors)');
    });

    // Happy-path guard: a clean run (errors=0) must not regress to 'partial', and
    // must keep errorMessage null — the column should not fill up with success noise.
    it('records a result with success=true and errors=0 as status=success, with errorMessage null', async () => {
        await recordCronRun({
            jobName: 'page-revalidation',
            executionMode: 'scheduled',
            dryRun: false,
            startedAt: new Date(),
            result: {
                success: true,
                message: 'Revalidated 2 entity types (0 errors)',
                processed: 2,
                errors: 0,
                durationMs: 100
            }
        });

        const { data } = mockRecordRun.mock.calls[0]?.[0] as { data: Record<string, unknown> };
        expect(data.status).toBe('success');
        expect(data.errorMessage).toBeNull();
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

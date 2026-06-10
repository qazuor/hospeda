/**
 * Cron Bootstrap Tests
 *
 * Verifies that the scheduler captures soft failures (result.success === false)
 * in Sentry and that thrown errors still follow the existing capture path.
 *
 * @module test/cron/bootstrap
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables — must be declared before any vi.mock factory
// ---------------------------------------------------------------------------

const { mockCaptureException, mockSchedule, mockGetEnabledCronJobs, mockRecordCronRun, mockEnv } =
    vi.hoisted(() => ({
        mockCaptureException: vi.fn(),
        mockSchedule: vi.fn(),
        mockGetEnabledCronJobs: vi.fn(),
        mockRecordCronRun: vi.fn(),
        mockEnv: { HOSPEDA_CRON_ADAPTER: 'node-cron' as string }
    }));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@sentry/node', () => ({
    captureException: mockCaptureException
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
    get env() {
        return mockEnv;
    }
}));

vi.mock('../../src/cron/registry', () => ({
    getEnabledCronJobs: mockGetEnabledCronJobs
}));

vi.mock('../../src/cron/record-run', () => ({
    recordCronRun: mockRecordCronRun
}));

// node-cron is a dynamic import — mock the whole module
vi.mock('node-cron', () => ({
    default: { schedule: mockSchedule },
    schedule: mockSchedule
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

import type { CronJobDefinition, CronJobResult } from '../../src/cron/types';

function makeJob(name: string, handler: () => Promise<CronJobResult>): CronJobDefinition {
    return {
        name,
        description: `${name} job`,
        schedule: '* * * * *',
        handler: (_ctx) => handler(),
        enabled: true
    };
}

function makeSuccessResult(): CronJobResult {
    return { success: true, message: 'ok', processed: 5, errors: 0, durationMs: 100 };
}

function makeSoftFailResult(errors = 3): CronJobResult {
    return {
        success: false,
        message: 'partial failure',
        processed: 2,
        errors,
        durationMs: 200
    };
}

/**
 * Capture the tick callback registered via nodeCron.schedule and invoke it.
 * node-cron.schedule is called with (schedule, callback) — we grab callback
 * at position 1 of the first call.
 */
async function fireTick(): Promise<void> {
    const tickCb = mockSchedule.mock.calls[0]?.[1] as (() => Promise<void>) | undefined;
    if (!tickCb) {
        throw new Error('No tick callback was registered by node-cron.schedule');
    }
    await tickCb();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('startCronScheduler — soft-failure Sentry capture', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-set defaults that clearAllMocks would wipe
        mockEnv.HOSPEDA_CRON_ADAPTER = 'node-cron';
        mockRecordCronRun.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('captures to Sentry when result.success === false', async () => {
        const job = makeJob('dunning', () => Promise.resolve(makeSoftFailResult(3)));
        mockGetEnabledCronJobs.mockReturnValue([job]);

        const { startCronScheduler } = await import('../../src/cron/bootstrap');
        await startCronScheduler();
        await fireTick();

        expect(mockCaptureException).toHaveBeenCalledOnce();
        const [capturedErr, capturedOpts] = mockCaptureException.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(capturedErr).toBeInstanceOf(Error);
        expect((capturedErr as Error).message).toMatch(/dunning/i);
        expect(capturedOpts).toMatchObject({
            level: 'warning',
            tags: expect.objectContaining({
                module: 'cron',
                job_name: 'dunning'
            })
        });
    });

    it('includes errors count in the capture context', async () => {
        const job = makeJob('exchange-rate', () => Promise.resolve(makeSoftFailResult(7)));
        mockGetEnabledCronJobs.mockReturnValue([job]);

        const { startCronScheduler } = await import('../../src/cron/bootstrap');
        await startCronScheduler();
        await fireTick();

        const [, capturedOpts] = mockCaptureException.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        const contexts = capturedOpts.contexts as Record<string, Record<string, unknown>>;
        expect(contexts?.cron?.errors).toBe(7);
    });

    it('does NOT capture to Sentry when result.success === true', async () => {
        const job = makeJob('dunning', () => Promise.resolve(makeSuccessResult()));
        mockGetEnabledCronJobs.mockReturnValue([job]);

        const { startCronScheduler } = await import('../../src/cron/bootstrap');
        await startCronScheduler();
        await fireTick();

        expect(mockCaptureException).not.toHaveBeenCalled();
    });

    it('uses the thrown-error capture path (not soft-failure) when the handler throws', async () => {
        const boom = new Error('db exploded');
        const job = makeJob('dunning', () => Promise.reject(boom));
        mockGetEnabledCronJobs.mockReturnValue([job]);

        const { startCronScheduler } = await import('../../src/cron/bootstrap');
        await startCronScheduler();
        await fireTick();

        // Exactly one capture — from the catch block, NOT from soft-failure
        expect(mockCaptureException).toHaveBeenCalledOnce();
        const [capturedErr, capturedOpts] = mockCaptureException.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        // The thrown-error path uses level: 'error', not 'warning'
        expect((capturedErr as Error).message).toBe('db exploded');
        expect(capturedOpts).toMatchObject({ level: 'error' });
    });
});

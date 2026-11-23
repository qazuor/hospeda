import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { purge, clock } = vi.hoisted(() => ({
    purge: vi.fn(),
    clock: { now: () => new Date('2026-11-23T12:00:00.000Z') }
}));
vi.mock('@repo/service-core', async (original) => ({
    ...(await original<typeof import('@repo/service-core')>()),
    purgeUnverifiedInquiries: purge
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock }) }));

import { unverifiedInquiryCleanupJob } from '../../src/cron/jobs/unverified-inquiry-cleanup.job';

function context(dryRun = false): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date(),
        runId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        dryRun
    };
}

describe('unverified inquiry cleanup cron', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.restoreAllMocks());
    it('registers metadata', () =>
        expect(unverifiedInquiryCleanupJob).toMatchObject({
            name: 'unverified-inquiry-cleanup',
            schedule: '15 3 * * *',
            enabled: true,
            timeoutMs: 60_000
        }));
    it('injects the clock and maps the deleted count', async () => {
        purge.mockResolvedValue({ deleted: 3, cutoff: new Date() });
        const result = await unverifiedInquiryCleanupJob.handler(context());
        expect(purge).toHaveBeenCalledWith({ clock });
        expect(result).toMatchObject({ success: true, processed: 3, errors: 0 });
    });
    it('does not delete anything in dry run', async () => {
        expect(await unverifiedInquiryCleanupJob.handler(context(true))).toMatchObject({
            success: true,
            processed: 0,
            errors: 0
        });
        expect(purge).not.toHaveBeenCalled();
    });
    it('reports failures', async () => {
        purge.mockRejectedValue(new Error('boom'));
        expect(await unverifiedInquiryCleanupJob.handler(context())).toMatchObject({
            success: false,
            processed: 0,
            errors: 1
        });
    });
});

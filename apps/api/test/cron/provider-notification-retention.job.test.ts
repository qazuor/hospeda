import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { purge, clock } = vi.hoisted(() => ({
    purge: vi.fn(),
    clock: { now: () => new Date('2026-10-11T12:00:00.000Z') }
}));
vi.mock('@repo/service-core', async (original) => ({
    ...(await original<typeof import('@repo/service-core')>()),
    purgeProviderNotifications: purge
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock }) }));

import { providerNotificationRetentionJob } from '../../src/cron/jobs/provider-notification-retention.job';

function context(dryRun = false): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date(),
        runId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        dryRun
    };
}

describe('provider delivery retention cron', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.restoreAllMocks());
    it('registers metadata', () =>
        expect(providerNotificationRetentionJob).toMatchObject({
            name: 'provider-notification-retention',
            schedule: '30 3 * * *',
            enabled: true,
            timeoutMs: 60_000
        }));
    it('injects clock and maps the deleted count', async () => {
        purge.mockResolvedValue({ deleted: 4, cutoff: new Date() });
        const result = await providerNotificationRetentionJob.handler(context());
        expect(purge).toHaveBeenCalledWith({}, { clock });
        expect(result).toMatchObject({ success: true, processed: 4, errors: 0 });
    });
    it('skips service in dry run', async () => {
        expect(await providerNotificationRetentionJob.handler(context(true))).toMatchObject({
            success: true,
            processed: 0,
            errors: 0
        });
        expect(purge).not.toHaveBeenCalled();
    });
    it('reports service errors', async () => {
        purge.mockRejectedValue(new Error('service failed'));
        expect(await providerNotificationRetentionJob.handler(context())).toMatchObject({
            success: false,
            processed: 0,
            errors: 1
        });
    });
});

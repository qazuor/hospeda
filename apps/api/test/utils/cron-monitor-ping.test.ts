import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureCheckIn } = vi.hoisted(() => ({ captureCheckIn: vi.fn() }));
vi.mock('@sentry/node', () => ({ captureCheckIn }));
vi.mock('../../src/utils/logger.js', () => ({ apiLogger: { warn: vi.fn() } }));

import { createSentryCronMonitorPing } from '../../src/utils/cron-monitor-ping.js';

describe('cron monitor ping adapter', () => {
    beforeEach(() => vi.clearAllMocks());
    it('captures an OK daily check-in with a two-hour margin', async () => {
        await createSentryCronMonitorPing().ping({
            sweep: 'RECONCILIATION',
            runId: 'id',
            finishedAt: new Date()
        });
        expect(captureCheckIn).toHaveBeenCalledWith(
            { monitorSlug: 'billing-reconciliation-sweep', status: 'ok' },
            { schedule: { type: 'interval', value: 1, unit: 'day' }, checkinMargin: 120 }
        );
    });
    it('swallows monitor failures', async () => {
        captureCheckIn.mockImplementation(() => {
            throw new Error('offline');
        });
        await expect(
            createSentryCronMonitorPing().ping({
                sweep: 'RECONCILIATION',
                runId: 'id',
                finishedAt: new Date()
            })
        ).resolves.toBeUndefined();
    });
});

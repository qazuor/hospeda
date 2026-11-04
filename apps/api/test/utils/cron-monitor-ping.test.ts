import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureCheckIn } = vi.hoisted(() => ({ captureCheckIn: vi.fn() }));
vi.mock('@sentry/node', () => ({ captureCheckIn }));
vi.mock('../../src/utils/logger.js', () => ({ apiLogger: { warn: vi.fn() } }));

import { createSentryCronMonitorPing } from '../../src/utils/cron-monitor-ping.js';

describe('cron monitor ping adapter', () => {
    beforeEach(() => vi.clearAllMocks());
    it('captures the 02:10 market-time check-in with a 170-minute margin', async () => {
        await createSentryCronMonitorPing().ping({
            sweep: 'RECONCILIATION',
            runId: 'id',
            finishedAt: new Date()
        });
        expect(captureCheckIn).toHaveBeenCalledWith(
            { monitorSlug: 'billing-reconciliation-sweep', status: 'ok' },
            {
                schedule: { type: 'crontab', value: '10 2 * * *' },
                timezone: 'America/Argentina/Buenos_Aires',
                checkinMargin: 170
            }
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

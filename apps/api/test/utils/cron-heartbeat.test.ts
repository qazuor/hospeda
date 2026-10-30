import { describe, expect, it, vi } from 'vitest';
import { pingCronMonitor } from '../../src/utils/cron-heartbeat';

vi.mock('@sentry/node', () => ({
    isInitialized: vi.fn(() => true),
    captureCheckIn: vi.fn()
}));

describe('cron heartbeat', () => {
    it('sends a successful Sentry check-in using the job slug', async () => {
        const captureCheckIn = vi.fn();
        await pingCronMonitor({
            job: 'listing-coverage-reconciler',
            sentry: {
                isInitialized: () => true,
                captureCheckIn
            }
        });
        expect(captureCheckIn).toHaveBeenCalledWith(
            { monitorSlug: 'listing-coverage-reconciler', status: 'ok' },
            {
                schedule: { type: 'crontab', value: '0 5 * * *' },
                timezone: 'America/Argentina/Buenos_Aires'
            }
        );
    });

    it('sends the given schedule and check-in margin', async () => {
        const captureCheckIn = vi.fn();
        await pingCronMonitor({
            job: 'listing-remote-deletion-retry',
            schedule: '45 5 * * *',
            checkinMargin: 120,
            sentry: { isInitialized: () => true, captureCheckIn }
        });
        expect(captureCheckIn).toHaveBeenCalledWith(
            { monitorSlug: 'listing-remote-deletion-retry', status: 'ok' },
            {
                schedule: { type: 'crontab', value: '45 5 * * *' },
                timezone: 'America/Argentina/Buenos_Aires',
                checkinMargin: 120
            }
        );
    });

    it('defaults to the reconciler schedule and sends no check-in margin', async () => {
        const captureCheckIn = vi.fn();
        await pingCronMonitor({
            job: 'listing-coverage-reconciler',
            sentry: { isInitialized: () => true, captureCheckIn }
        });
        expect(captureCheckIn).toHaveBeenCalledOnce();
        const config = captureCheckIn.mock.calls[0]?.[1];
        expect(config).toEqual({
            schedule: { type: 'crontab', value: '0 5 * * *' },
            timezone: 'America/Argentina/Buenos_Aires'
        });
        expect(config).not.toHaveProperty('checkinMargin');
    });

    it('contains monitor failures', async () => {
        await expect(
            pingCronMonitor({
                job: 'listing-coverage-reconciler',
                sentry: {
                    isInitialized: () => true,
                    captureCheckIn: () => {
                        throw new Error('offline');
                    }
                }
            })
        ).resolves.toBeUndefined();
    });
});

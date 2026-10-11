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

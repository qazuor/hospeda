import type { SweepLivenessPing, SweepName } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { apiLogger } from './logger.js';

type MonitorConfig = NonNullable<Parameters<typeof Sentry.captureCheckIn>[1]>;

const monitorBySweep: Record<SweepName, { monitorSlug: string; config: MonitorConfig }> = {
    RECONCILIATION: {
        monitorSlug: 'billing-reconciliation-sweep',
        config: { schedule: { type: 'interval', value: 1, unit: 'day' }, checkinMargin: 120 }
    }
};

export function createSentryCronMonitorPing(): SweepLivenessPing {
    return {
        async ping({ sweep }) {
            const monitor = monitorBySweep[sweep];
            try {
                Sentry.captureCheckIn(
                    { monitorSlug: monitor.monitorSlug, status: 'ok' },
                    monitor.config
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                apiLogger.warn(`Sentry cron monitor ping failed; sweep continues (${message})`);
            }
        }
    };
}

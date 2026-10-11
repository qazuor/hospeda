import * as Sentry from '@sentry/node';
import { apiLogger } from './logger';

interface SentryCronClient {
    captureCheckIn(
        checkIn: { readonly monitorSlug: string; readonly status: 'ok' },
        config: {
            readonly schedule: { readonly type: 'crontab'; readonly value: string };
            readonly timezone: string;
        }
    ): unknown;
    isInitialized(): boolean;
}

/** Sends a successful daily job check-in to Sentry when the SDK is initialized. */
export async function pingCronMonitor(args: {
    readonly job: string;
    readonly sentry?: SentryCronClient;
}): Promise<void> {
    const sentry = args.sentry ?? (Sentry as SentryCronClient);
    try {
        if (!sentry.isInitialized()) return;
        sentry.captureCheckIn(
            { monitorSlug: args.job, status: 'ok' },
            {
                schedule: { type: 'crontab', value: '0 5 * * *' },
                timezone: 'America/Argentina/Buenos_Aires'
            }
        );
    } catch (error) {
        apiLogger.warn({
            message: 'Cron monitor check-in failed',
            job: args.job,
            error: error instanceof Error ? error.message : String(error)
        });
        // Monitoring outages never alter the reconciler's result.
    }
}

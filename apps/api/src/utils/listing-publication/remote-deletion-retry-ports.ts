import { listingPurgeModel } from '@repo/db';
import type { RemoteDeletionRetryPorts } from '@repo/verticals';
import { CRON_SCHEDULES } from '../../cron/schedules.manifest';
import { pingCronMonitor } from '../cron-heartbeat';
import { getPurgeAfterCommit } from './purge-ports';

/**
 * Check-in margin of the retry's cron monitor, in minutes: one day plus two hours, so the
 * external monitor alerts when 26 h pass without a ping (AC:V6:30).
 */
export const REMOTE_DELETION_RETRY_CHECKIN_MARGIN_MINUTES = 120;

/**
 * Builds the production ports of the daily retry of PB12 remote deletions: the marked-row
 * population from `listingPurgeModel`, the PB12 post-commit adapters, and the cron monitor
 * pinged with this job's schedule from the cron manifest.
 */
export function getRemoteDeletionRetryPorts(): RemoteDeletionRetryPorts {
    const { deleteRemoteMedia, revokeCalendarConnection } = getPurgeAfterCommit();
    return {
        pending: {
            listMarkedMedia: async ({ after, limit }) =>
                listingPurgeModel.listMarkedMedia({ after, limit }),
            listMarkedCalendarConnections: async ({ after, limit }) =>
                listingPurgeModel.listMarkedCalendarConnections({ after, limit })
        },
        remote: { deleteRemoteMedia, revokeCalendarConnection },
        monitor: {
            ping: async ({ job }) => {
                const entry = CRON_SCHEDULES.find(({ name }) => name === job);
                if (!entry) {
                    throw new Error(`Cron schedule for ${job} is missing from the manifest`);
                }
                await pingCronMonitor({
                    job,
                    schedule: entry.schedule,
                    checkinMargin: REMOTE_DELETION_RETRY_CHECKIN_MARGIN_MINUTES
                });
            }
        }
    };
}

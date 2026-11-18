/**
 * Admin session recording routes (HOS-2347 retention). Mounted at
 * `/api/v1/admin/session-recording`.
 *
 * The retention period itself is part of the `analytics.sessionRecording`
 * platform setting and travels through `/api/v1/admin/platform-settings`; this
 * router only adds the manual "clean up now" action.
 *
 * Gate: `ANALYTICS_SESSION_RECORDING_MANAGE`, the same permission as the switch.
 */
import { PermissionEnum, SessionRecordingPurgeResponseSchema } from '@repo/schemas';
import { PlatformSettingsService } from '@repo/service-core';
import {
    purgeSessionRecordingsFromEnv,
    throwPurgeNotConfigured
} from '../../../services/session-recording-purge.js';
import { createRouter } from '../../../utils/create-app.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const settings = new PlatformSettingsService({ logger: apiLogger });

/**
 * POST /api/v1/admin/session-recording/purge
 *
 * Deletes the Umami replays and heatmap events older than the configured
 * retention, now, and answers the counts.
 *
 * Responses:
 *   200 - `{ replaysDeleted, heatmapEventsDeleted, retentionDays }`.
 *   401 - unauthenticated.
 *   403 - authenticated without `ANALYTICS_SESSION_RECORDING_MANAGE`.
 *   503 - `SERVICE_UNAVAILABLE` (`reason: RECORDING_PURGE_NOT_CONFIGURED`) when
 *         the restricted Umami database connection or the web website id is unset.
 */
export const adminPurgeSessionRecordingsRoute = createAdminRoute({
    method: 'post',
    path: '/purge',
    summary: 'Purge expired Umami session recordings now',
    description:
        'Deletes the Umami session replays and heatmap events older than the configured retention (14, 30 or 60 days) for the web website, and returns how many rows were deleted. Answers 503 when the restricted Umami database connection is not configured.',
    tags: ['Platform Settings'],
    requiredPermissions: [PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE],
    responseSchema: SessionRecordingPurgeResponseSchema,
    // An action, not a creation: nothing new is addressable afterwards.
    successStatusCode: 200,
    handler: async () => {
        const retentionDays = await settings.getSessionRecordingRetentionDays();
        const outcome = await purgeSessionRecordingsFromEnv({ retentionDays });
        if (outcome.status === 'skipped') {
            throwPurgeNotConfigured(outcome.reason);
        }
        apiLogger.info(
            {
                retentionDays,
                replaysDeleted: outcome.replaysDeleted,
                heatmapEventsDeleted: outcome.heatmapEventsDeleted
            },
            'Manual session recording purge completed'
        );
        return {
            replaysDeleted: outcome.replaysDeleted,
            heatmapEventsDeleted: outcome.heatmapEventsDeleted,
            retentionDays
        };
    }
});

const router = createRouter();
router.route('/', adminPurgeSessionRecordingsRoute);

export { router as adminSessionRecordingRoutes };

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
import {
    PermissionEnum,
    ServiceErrorCode,
    SessionRecordingPurgeRequestSchema,
    SessionRecordingPurgeResponseSchema
} from '@repo/schemas';
import { PlatformSettingsService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import {
    purgeSessionRecordingsFromEnv,
    throwPurgeNotConfigured
} from '../../../services/session-recording-purge.js';
import { createRouter } from '../../../utils/create-app.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const settings = new PlatformSettingsService({ logger: apiLogger });

/** Time budget of one manual purge; what is left is finished by the next daily run. */
export const MANUAL_PURGE_TIME_BUDGET_MS = 60_000;

/**
 * POST /api/v1/admin/session-recording/purge
 *
 * Deletes the Umami replays (saved ones included), heatmap events and saved
 * pointers older than the configured retention, now, within a time budget.
 * The body carries the period the admin confirmed; the purge refuses when the
 * stored period changed since.
 *
 * Responses:
 *   200 - `{ replaysDeleted, heatmapEventsDeleted, savedReplaysDeleted, retentionDays, stoppedEarly }`.
 *   400 - the body is not `{ retentionDays: 14 | 30 | 60 }`.
 *   401 - unauthenticated.
 *   403 - authenticated without `ANALYTICS_SESSION_RECORDING_MANAGE`.
 *   409 - `ALREADY_EXISTS` with `reason: RECORDING_RETENTION_MISMATCH` (the stored period
 *         differs from the confirmed one, `details.storedRetentionDays` says which) or
 *         `reason: RECORDING_PURGE_ALREADY_RUNNING`.
 *   503 - `SERVICE_UNAVAILABLE` when the restricted Umami database connection or the web
 *         website id is unset. A 5xx masks its reason (HOS-2296): the body carries only the
 *         code, and the cause is in the server log.
 */
export const adminPurgeSessionRecordingsRoute = createAdminRoute({
    method: 'post',
    path: '/purge',
    summary: 'Purge expired Umami session recordings now',
    description:
        'Deletes the Umami session replays (saved ones included), heatmap events and saved-replay pointers older than the confirmed retention (14, 30 or 60 days) for the web website, within a 60 second budget, and returns how many rows were deleted. Answers 409 when the stored retention differs from the confirmed one or another purge is running, and 503 when the restricted Umami database connection is not configured.',
    tags: ['Platform Settings'],
    requiredPermissions: [PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE],
    requestBody: SessionRecordingPurgeRequestSchema,
    responseSchema: SessionRecordingPurgeResponseSchema,
    // An action, not a creation: nothing new is addressable afterwards.
    successStatusCode: 200,
    handler: async (
        _ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const confirmed = SessionRecordingPurgeRequestSchema.parse(body);
        const retentionDays = await settings.getSessionRecordingRetentionDays();
        if (retentionDays !== confirmed.retentionDays) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'The retention period changed since it was confirmed',
                { storedRetentionDays: retentionDays },
                'RECORDING_RETENTION_MISMATCH'
            );
        }
        const outcome = await purgeSessionRecordingsFromEnv({
            retentionDays,
            signal: AbortSignal.timeout(MANUAL_PURGE_TIME_BUDGET_MS)
        });
        if (outcome.status === 'skipped') {
            throwPurgeNotConfigured(outcome.reason);
        }
        if (outcome.status === 'locked') {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'A recording purge is already running',
                undefined,
                'RECORDING_PURGE_ALREADY_RUNNING'
            );
        }
        apiLogger.info(
            {
                retentionDays,
                replaysDeleted: outcome.replaysDeleted,
                heatmapEventsDeleted: outcome.heatmapEventsDeleted,
                savedReplaysDeleted: outcome.savedReplaysDeleted,
                stoppedEarly: outcome.stoppedEarly
            },
            'Manual session recording purge completed'
        );
        return {
            replaysDeleted: outcome.replaysDeleted,
            heatmapEventsDeleted: outcome.heatmapEventsDeleted,
            savedReplaysDeleted: outcome.savedReplaysDeleted,
            retentionDays,
            stoppedEarly: outcome.stoppedEarly
        };
    }
});

const router = createRouter();
router.route('/', adminPurgeSessionRecordingsRoute);

export { router as adminSessionRecordingRoutes };

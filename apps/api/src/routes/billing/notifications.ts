/**
 * Notification Management Routes
 *
 * API endpoints for managing billing notification logs.
 * Provides cleanup and retention policy management.
 *
 * Routes:
 * - POST /api/v1/billing/notifications/cleanup - Run retention policy (admin only)
 *
 * @module routes/billing/notifications
 */

import { PermissionEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { NotificationRetentionService } from '../../services/notification-retention.service';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute } from '../../utils/route-factory';

/**
 * Retention policy cleanup response schema
 */
const cleanupResponseSchema = z.object({
    success: z.boolean(),
    markedExpired: z.number(),
    purged: z.number(),
    message: z.string()
});

/**
 * Handler for notification log cleanup
 * Extracted for testability
 *
 * @param c - Hono context
 * @returns Response with cleanup summary
 * @throws HTTPException 500 if service fails
 */
export const handleCleanup = async (
    _c: Parameters<Parameters<typeof createAdminRoute>[0]['handler']>[0]
) => {
    const retentionService = new NotificationRetentionService();

    try {
        const result = await retentionService.runRetentionPolicy();

        return {
            success: true,
            markedExpired: result.markedExpired,
            purged: result.purged,
            message: `Retention policy executed: ${result.markedExpired} marked expired, ${result.purged} purged`
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            {
                error: errorMessage
            },
            'Failed to run notification retention policy'
        );

        throw new HTTPException(500, {
            message: `Failed to run retention policy: ${errorMessage}`
        });
    }
};

/**
 * POST /api/v1/billing/notifications/cleanup
 * Run notification log retention policy (admin only)
 *
 * This endpoint is meant to be called by a cron job or admin interface.
 * It executes the retention policy:
 * 1. Marks notifications older than 90 days as expired
 * 2. Permanently deletes notifications expired for more than 30 days
 */
export const cleanupRoute = createAdminRoute({
    method: 'post',
    path: '/cleanup',
    summary: 'Run notification log cleanup',
    description: 'Execute retention policy: mark old logs as expired and purge long-expired logs',
    tags: ['Billing', 'Notifications', 'Admin'],
    responseSchema: cleanupResponseSchema,
    requiredPermissions: [PermissionEnum.ACCESS_API_ADMIN],
    handler: handleCleanup
});

/**
 * Notification routes router
 */
const notificationsRouter = createRouter();

notificationsRouter.route('/', cleanupRoute);

export default notificationsRouter;

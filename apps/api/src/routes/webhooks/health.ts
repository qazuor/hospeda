/**
 * Webhook Health Monitoring Endpoint
 *
 * Health probe for the webhook system. The legacy billing webhook event log
 * and dead-letter queue were removed with the legacy billing system
 * (HOS-1416), so there is nothing left to count; the endpoint stays as the
 * mount-point health signal the webhook surface reports.
 *
 * Protected by admin auth (SYSTEM_MAINTENANCE_MODE).
 *
 * @module routes/webhooks/health
 */

import { PermissionEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { adminAuthMiddleware } from '../../middlewares/authorization';
import type { AppBindings } from '../../types';

/**
 * Webhook health monitoring router
 */
export const webhookHealthRoutes = new Hono<AppBindings>();

/**
 * GET /health
 *
 * Returns webhook system health.
 */
webhookHealthRoutes.get(
    '/health',
    adminAuthMiddleware([PermissionEnum.SYSTEM_MAINTENANCE_MODE]),
    (c) => {
        return c.json({
            success: true,
            data: {
                status: 'ok',
                note: 'Legacy billing webhook processing metrics were removed with the legacy billing system (HOS-1416).'
            }
        });
    }
);

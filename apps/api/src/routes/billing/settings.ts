/**
 * Billing Settings Routes
 *
 * Admin-only API endpoints for managing billing configuration settings.
 * Settings control trial periods, grace periods, payment retry logic, and notifications.
 *
 * Routes:
 * - GET  /api/v1/protected/billing/settings - Get current billing settings (admin only)
 * - PATCH /api/v1/protected/billing/settings - Update billing settings (admin only)
 * - POST /api/v1/protected/billing/settings/reset - Reset to default settings (admin only)
 *
 * @module routes/billing/settings
 */

import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../middlewares/actor';
import { getBillingSettingsService } from '../../services/billing-settings.service';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute } from '../../utils/route-factory';

/**
 * Billing settings schema
 */
const billingSettingsSchema = z.object({
    ownerTrialDays: z.number().int().min(1).max(90),
    complexTrialDays: z.number().int().min(1).max(90),
    trialAutoBlock: z.boolean(),
    gracePeriodDays: z.number().int().min(0).max(30),
    currency: z.string().length(3),
    taxRate: z.number().min(0).max(100),
    maxPaymentRetries: z.number().int().min(0).max(10),
    retryIntervalHours: z.number().int().min(1).max(168),
    sendTrialExpiryReminder: z.boolean(),
    trialExpiryReminderDays: z.number().int().min(1).max(30),
    sendPaymentFailedNotification: z.boolean(),
    sendSubscriptionCancelledNotification: z.boolean()
});

/**
 * Update billing settings request schema (partial)
 */
const updateBillingSettingsSchema = billingSettingsSchema.partial();

/**
 * Reset settings response schema
 */
const resetSettingsResponseSchema = z.object({
    success: z.boolean(),
    settings: billingSettingsSchema,
    message: z.string()
});

/**
 * GET /api/v1/protected/billing/settings
 * Get current billing settings (admin only)
 */
export const getBillingSettingsRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'Get billing settings',
    description: 'Returns current billing configuration settings',
    tags: ['Billing', 'Settings', 'Admin'],
    responseSchema: billingSettingsSchema,
    handler: async (c) => {
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            throw new HTTPException(503, {
                message: 'Billing service is not configured'
            });
        }

        const settingsService = getBillingSettingsService();
        const settings = await settingsService.getSettings();

        return settings;
    }
});

/**
 * PATCH /api/v1/protected/billing/settings
 * Update billing settings (admin only, partial update)
 */
export const updateBillingSettingsRoute = createAdminRoute({
    method: 'patch',
    path: '/',
    summary: 'Update billing settings',
    description: 'Update billing configuration settings (partial update)',
    tags: ['Billing', 'Settings', 'Admin'],
    requestBody: updateBillingSettingsSchema,
    responseSchema: billingSettingsSchema,
    handler: async (c, _params, body) => {
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            throw new HTTPException(503, {
                message: 'Billing service is not configured'
            });
        }

        // Get actor for audit trail
        const actor = getActorFromContext(c);
        const actorId = actor?.id || undefined;

        const settingsService = getBillingSettingsService();

        try {
            const updatedSettings = await settingsService.updateSettings(body, actorId);

            apiLogger.info(
                {
                    actorId,
                    updatedFields: Object.keys(body)
                },
                'Billing settings updated via API'
            );

            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actorId ?? 'unknown',
                action: 'update',
                resourceType: 'billing_settings',
                resourceId: 'global'
            });

            return updatedSettings;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    actorId,
                    body,
                    error: errorMessage
                },
                'Failed to update billing settings via API'
            );

            throw new HTTPException(400, {
                message: `Failed to update settings: ${errorMessage}`
            });
        }
    }
});

/**
 * POST /api/v1/protected/billing/settings/reset
 * Reset billing settings to defaults (admin only)
 */
export const resetBillingSettingsRoute = createAdminRoute({
    method: 'post',
    path: '/reset',
    summary: 'Reset billing settings',
    description: 'Reset billing configuration settings to default values',
    tags: ['Billing', 'Settings', 'Admin'],
    responseSchema: resetSettingsResponseSchema,
    handler: async (c) => {
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            throw new HTTPException(503, {
                message: 'Billing service is not configured'
            });
        }

        // Get actor for audit trail
        const actor = getActorFromContext(c);
        const actorId = actor?.id || undefined;

        const settingsService = getBillingSettingsService();

        try {
            const defaultSettings = await settingsService.resetSettings(actorId);

            apiLogger.info(
                {
                    actorId
                },
                'Billing settings reset to defaults via API'
            );

            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actorId ?? 'unknown',
                action: 'update',
                resourceType: 'billing_settings',
                resourceId: 'default'
            });

            return {
                success: true,
                settings: defaultSettings,
                message: 'Billing settings reset to defaults successfully'
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    actorId,
                    error: errorMessage
                },
                'Failed to reset billing settings via API'
            );

            throw new HTTPException(500, {
                message: `Failed to reset settings: ${errorMessage}`
            });
        }
    }
});

/**
 * Billing settings routes router
 */
const settingsRouter = createRouter();

settingsRouter.route('/', getBillingSettingsRoute);
settingsRouter.route('/', updateBillingSettingsRoute);
settingsRouter.route('/', resetBillingSettingsRoute);

export { settingsRouter };

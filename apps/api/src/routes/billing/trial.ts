/**
 * Trial Routes
 *
 * API endpoints for managing 14-day trial lifecycle.
 * Provides trial status checking and expiry management.
 *
 * Routes:
 * - GET  /api/v1/billing/trial/status - Get current trial status (authenticated)
 * - POST /api/v1/billing/trial/start - Start trial for authenticated user
 * - POST /api/v1/billing/trial/extend - Extend trial by additional days (admin only)
 * - POST /api/v1/billing/trial/check-expiry - Trigger expired trial check (admin only)
 *
 * @module routes/billing/trial
 */

import { PermissionEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getQZPayBilling } from '../../middlewares/billing';
import { TrialService } from '../../services/trial.service';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute, createSimpleRoute } from '../../utils/route-factory';

/**
 * Trial status response schema
 */
const trialStatusResponseSchema = z.object({
    isOnTrial: z.boolean(),
    isExpired: z.boolean(),
    startedAt: z.string().nullable(),
    expiresAt: z.string().nullable(),
    daysRemaining: z.number(),
    planSlug: z.string().nullable()
});

/**
 * Start trial request schema
 */
const startTrialRequestSchema = z.object({
    userType: z.enum(['owner', 'complex'])
});

/**
 * Start trial response schema
 */
const startTrialResponseSchema = z.object({
    success: z.boolean(),
    subscriptionId: z.string().nullable(),
    message: z.string().optional()
});

/**
 * Extend trial request schema
 */
const extendTrialRequestSchema = z.object({
    subscriptionId: z.string(),
    additionalDays: z.number().int().min(1).max(90)
});

/**
 * Extend trial response schema
 */
const extendTrialResponseSchema = z.object({
    success: z.boolean(),
    newTrialEnd: z.string().nullable(),
    message: z.string()
});

/**
 * Check expiry response schema
 */
const checkExpiryResponseSchema = z.object({
    success: z.boolean(),
    blockedCount: z.number(),
    message: z.string()
});

/**
 * GET /api/v1/billing/trial/status
 * Get trial status for authenticated user
 */
export const getTrialStatusRoute = createSimpleRoute({
    method: 'get',
    path: '/status',
    summary: 'Get trial status',
    description: 'Returns current trial status for the authenticated user',
    tags: ['Billing', 'Trial'],
    responseSchema: trialStatusResponseSchema,
    handler: async (c) => {
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            throw new HTTPException(503, {
                message: 'Billing service is not configured'
            });
        }

        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            throw new HTTPException(400, {
                message: 'No billing account found'
            });
        }

        const billing = getQZPayBilling();
        const trialService = new TrialService(billing);

        const status = await trialService.getTrialStatus({
            customerId: billingCustomerId
        });

        return status;
    }
});

/**
 * POST /api/v1/billing/trial/start
 * Start trial for authenticated user
 *
 * This endpoint starts a trial subscription for the authenticated user.
 * The billing customer ID is obtained from the user's billing context.
 */
export const startTrialRoute = createSimpleRoute({
    method: 'post',
    path: '/start',
    summary: 'Start trial',
    description: 'Start a trial subscription for the authenticated user',
    tags: ['Billing', 'Trial'],
    responseSchema: startTrialResponseSchema,
    handler: async (c) => {
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            throw new HTTPException(503, {
                message: 'Billing service is not configured'
            });
        }

        // Get billing customer ID from authenticated user context
        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            throw new HTTPException(400, {
                message: 'No billing account found'
            });
        }

        // Parse request body
        const body = await c.req.json();
        const parseResult = startTrialRequestSchema.safeParse(body);

        if (!parseResult.success) {
            throw new HTTPException(400, {
                message: 'Invalid request body',
                cause: parseResult.error.flatten()
            });
        }

        const { userType } = parseResult.data;
        const customerId = billingCustomerId;

        const billing = getQZPayBilling();
        const trialService = new TrialService(billing);

        try {
            const subscriptionId = await trialService.startTrial({
                customerId,
                userType
            });

            if (!subscriptionId) {
                return {
                    success: false,
                    subscriptionId: null,
                    message: 'User already has a subscription or trial could not be created'
                };
            }

            return {
                success: true,
                subscriptionId,
                message: 'Trial started successfully'
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    customerId,
                    userType,
                    error: errorMessage
                },
                'Failed to start trial'
            );

            return {
                success: false,
                subscriptionId: null,
                message: `Failed to start trial: ${errorMessage}`
            };
        }
    }
});

/**
 * POST /api/v1/billing/trial/extend
 * Extend a trial subscription by additional days (admin only)
 */
export const extendTrialRoute = createAdminRoute({
    method: 'post',
    path: '/extend',
    summary: 'Extend trial period',
    description: 'Extend a trial subscription by additional days (admin only)',
    tags: ['Billing', 'Trial', 'Admin'],
    requestBody: extendTrialRequestSchema,
    responseSchema: extendTrialResponseSchema,
    requiredPermissions: [PermissionEnum.MANAGE_SUBSCRIPTIONS],
    handler: async (c, _params, body) => {
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            throw new HTTPException(503, {
                message: 'Billing service is not configured'
            });
        }

        const { subscriptionId, additionalDays } = body as {
            subscriptionId: string;
            additionalDays: number;
        };

        const billing = getQZPayBilling();
        const trialService = new TrialService(billing);

        try {
            const result = await trialService.extendTrial({
                subscriptionId,
                additionalDays
            });

            return {
                success: true,
                newTrialEnd: result.newTrialEnd,
                message: `Trial extended by ${additionalDays} day(s)`
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    subscriptionId,
                    additionalDays,
                    error: errorMessage
                },
                'Failed to extend trial'
            );

            return {
                success: false,
                newTrialEnd: null,
                message: `Failed to extend trial: ${errorMessage}`
            };
        }
    }
});

/**
 * Handler for checking and blocking expired trials
 * Extracted for testability
 *
 * @param c - Hono context
 * @returns Response with blocked trial count
 * @throws HTTPException 503 if billing not configured
 * @throws HTTPException 500 if service fails
 */
export const handleCheckExpiry = async (
    c: Parameters<Parameters<typeof createAdminRoute>[0]['handler']>[0]
) => {
    const billingEnabled = c.get('billingEnabled');

    if (!billingEnabled) {
        throw new HTTPException(503, {
            message: 'Billing service is not configured'
        });
    }

    const billing = getQZPayBilling();
    const trialService = new TrialService(billing);

    try {
        const blockedCount = await trialService.blockExpiredTrials();

        return {
            success: true,
            blockedCount,
            message: `Successfully blocked ${blockedCount} expired trial(s)`
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            {
                error: errorMessage
            },
            'Failed to run expired trial check'
        );

        throw new HTTPException(500, {
            message: `Failed to check expired trials: ${errorMessage}`
        });
    }
};

/**
 * POST /api/v1/billing/trial/check-expiry
 * Trigger batch expiry check (admin only)
 *
 * This endpoint is meant to be called by a cron job or admin interface.
 * It finds all expired trials and blocks them.
 */
export const checkExpiryRoute = createAdminRoute({
    method: 'post',
    path: '/check-expiry',
    summary: 'Check expired trials',
    description: 'Batch job to find and block all expired trials',
    tags: ['Billing', 'Trial', 'Admin'],
    responseSchema: checkExpiryResponseSchema,
    requiredPermissions: [PermissionEnum.MANAGE_SUBSCRIPTIONS],
    handler: handleCheckExpiry
});

/**
 * Trial routes router
 */
const trialRouter = createRouter();

trialRouter.route('/', getTrialStatusRoute);
trialRouter.route('/', startTrialRoute);
trialRouter.route('/', extendTrialRoute);
trialRouter.route('/', checkExpiryRoute);

export default trialRouter;

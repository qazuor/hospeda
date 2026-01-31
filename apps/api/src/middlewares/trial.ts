/**
 * Trial Middleware
 *
 * Blocks access to protected routes when user's trial has expired.
 * Returns 402 Payment Required with upgrade prompt.
 *
 * Allows access to:
 * - Billing and subscription management routes
 * - Trial status routes
 * - Data export routes (read-only)
 *
 * @module middlewares/trial
 */

import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { TrialService } from '../services/trial.service';
import type { AppBindings } from '../types';
import { apiLogger } from '../utils/logger';
import { getQZPayBilling } from './billing';

/**
 * Routes that are allowed even when trial has expired
 * These routes enable users to manage their subscription and export data
 */
const ALLOWED_ROUTES_WHEN_BLOCKED = [
    // Billing routes
    '/api/v1/billing',
    '/api/v1/billing/trial',
    '/api/v1/billing/subscriptions',
    '/api/v1/billing/plans',
    '/api/v1/billing/checkout',
    '/api/v1/billing/invoices',
    '/api/v1/billing/payments',

    // Data export routes
    '/api/v1/export',

    // Health and docs
    '/health',
    '/docs',
    '/reference',
    '/ui'
];

/**
 * Check if a route path is allowed when trial is blocked
 *
 * @param path - Request path
 * @returns True if route is allowed
 */
function isRouteAllowedWhenBlocked(path: string): boolean {
    return ALLOWED_ROUTES_WHEN_BLOCKED.some((allowedPath) => path.startsWith(allowedPath));
}

/**
 * Trial middleware
 *
 * Checks if authenticated user is on an expired trial.
 * If expired, returns 402 Payment Required unless route is in allowed list.
 *
 * Must run AFTER:
 * - Authentication middleware (to get billingCustomerId)
 * - Billing customer middleware (to have billingCustomerId in context)
 *
 * @example
 * ```typescript
 * import { trialMiddleware } from './middlewares/trial';
 *
 * // Apply globally (after auth and billing middleware)
 * app.use('*', actorMiddleware());
 * app.use('*', billingCustomerMiddleware());
 * app.use('*', trialMiddleware());
 *
 * // Or apply to specific routes
 * app.use('/api/v1/accommodations/*', trialMiddleware());
 * ```
 */
export const trialMiddleware = (): MiddlewareHandler<AppBindings> => {
    return async (c, next) => {
        // Check if billing is enabled
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            // Billing not enabled - skip trial check
            await next();
            return;
        }

        // Get billing customer ID (set by billing customer middleware)
        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            // No billing customer - skip trial check
            await next();
            return;
        }

        // Check if route is allowed when blocked
        const path = c.req.path;
        if (isRouteAllowedWhenBlocked(path)) {
            // Allow access to billing and export routes
            await next();
            return;
        }

        try {
            // Check trial status
            const billing = getQZPayBilling();
            const trialService = new TrialService(billing);

            const trialStatus = await trialService.getTrialStatus({
                customerId: billingCustomerId
            });

            // If trial is expired, block access
            if (trialStatus.isExpired) {
                apiLogger.warn(
                    {
                        customerId: billingCustomerId,
                        path,
                        expiresAt: trialStatus.expiresAt
                    },
                    'Blocked access due to expired trial'
                );

                throw new HTTPException(402, {
                    message:
                        'Your trial has expired. Please upgrade your subscription to continue using this feature.',
                    cause: {
                        code: 'TRIAL_EXPIRED',
                        trialStatus,
                        upgradeUrl: '/billing/plans'
                    }
                });
            }

            // Log trial warning if expiring soon (< 3 days)
            if (trialStatus.isOnTrial && trialStatus.daysRemaining <= 3) {
                apiLogger.warn(
                    {
                        customerId: billingCustomerId,
                        daysRemaining: trialStatus.daysRemaining,
                        expiresAt: trialStatus.expiresAt
                    },
                    'Trial expiring soon'
                );
            }
        } catch (error) {
            // If it's an HTTPException, rethrow it
            if (error instanceof HTTPException) {
                throw error;
            }

            // Log other errors but don't block the request
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.warn(
                {
                    customerId: billingCustomerId,
                    path,
                    error: errorMessage
                },
                'Error checking trial status - allowing request'
            );
        }

        await next();
    };
};

/**
 * Check if user is on trial (helper for route handlers)
 *
 * @param c - Hono context
 * @returns Trial status or null if billing disabled
 *
 * @example
 * ```typescript
 * import { checkTrialStatus } from '../middlewares/trial';
 *
 * app.get('/dashboard', async (c) => {
 *   const trialStatus = await checkTrialStatus(c);
 *
 *   if (trialStatus?.isOnTrial && trialStatus.daysRemaining <= 3) {
 *     // Show trial expiring warning
 *   }
 *
 *   return c.json({ dashboard: 'data' });
 * });
 * ```
 */
export async function checkTrialStatus(c: Context<AppBindings>) {
    const billingEnabled = c.get('billingEnabled');
    const billingCustomerId = c.get('billingCustomerId');

    if (!billingEnabled || !billingCustomerId) {
        return null;
    }

    const billing = getQZPayBilling();
    const trialService = new TrialService(billing);

    return await trialService.getTrialStatus({
        customerId: billingCustomerId
    });
}

/**
 * Require active trial or paid subscription
 *
 * Returns 402 if user doesn't have an active subscription or valid trial.
 * Use this on premium feature routes.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { requireActiveSubscription } from './middlewares/trial';
 *
 * app.post(
 *   '/premium-feature',
 *   requireActiveSubscription(),
 *   async (c) => {
 *     // User has active subscription or valid trial
 *     return c.json({ success: true });
 *   }
 * );
 * ```
 */
export function requireActiveSubscription(): MiddlewareHandler<AppBindings> {
    return async (c, next) => {
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            throw new HTTPException(503, {
                message: 'Billing service is not available'
            });
        }

        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            throw new HTTPException(402, {
                message: 'No billing account found. Please set up your subscription.',
                cause: {
                    code: 'NO_BILLING_ACCOUNT',
                    setupUrl: '/billing/setup'
                }
            });
        }

        const billing = getQZPayBilling();
        const trialService = new TrialService(billing);

        const trialStatus = await trialService.getTrialStatus({
            customerId: billingCustomerId
        });

        // Check if user has expired trial
        if (trialStatus.isExpired) {
            throw new HTTPException(402, {
                message: 'Your trial has expired. Please upgrade to continue.',
                cause: {
                    code: 'TRIAL_EXPIRED',
                    trialStatus,
                    upgradeUrl: '/billing/plans'
                }
            });
        }

        // Check if user has active subscription or valid trial
        if (!trialStatus.isOnTrial && !trialStatus.planSlug) {
            throw new HTTPException(402, {
                message: 'No active subscription found. Please subscribe to access this feature.',
                cause: {
                    code: 'NO_ACTIVE_SUBSCRIPTION',
                    subscribeUrl: '/billing/plans'
                }
            });
        }

        await next();
    };
}

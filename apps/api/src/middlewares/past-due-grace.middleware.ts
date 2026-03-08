/**
 * Past-Due Grace Period Middleware
 *
 * Enforces the grace period policy for subscriptions in `past_due` status.
 * Allows requests during the grace window and blocks them with 402 once the
 * grace period has expired.
 *
 * Behavior:
 * - Billing disabled or no customer: pass through silently
 * - Subscription NOT past_due: pass through immediately
 * - Subscription past_due + within grace: allow request, set `X-Grace-Period-Days-Remaining` header
 * - Subscription past_due + grace expired: return 402 with GRACE_PERIOD_EXPIRED error
 * - Any unexpected error: log and pass through (fail open)
 *
 * @module middlewares/past-due-grace.middleware
 */

import type { QZPaySubscriptionWithHelpers } from '@qazuor/qzpay-core';
import { PAYMENT_GRACE_PERIOD_DAYS } from '@repo/billing';
import type { AppMiddleware } from '../types';
import { apiLogger } from '../utils/logger';
import { getQZPayBilling } from './billing';

/**
 * Reference validation: log a warning at import time if the reference constant
 * diverges from the expected value. QZPay is the actual source of truth for
 * grace period enforcement. See: docs/billing/grace-period-source-of-truth.md
 */
if (PAYMENT_GRACE_PERIOD_DAYS !== 3) {
    apiLogger.warn(
        { configuredDays: PAYMENT_GRACE_PERIOD_DAYS, expectedDays: 3 },
        'PAYMENT_GRACE_PERIOD_DAYS diverges from expected value. Verify QZPay config is in sync.'
    );
}

/**
 * Paths exempt from grace period enforcement.
 * These are "recovery" paths that allow users to fix their billing status.
 */
const GRACE_EXEMPT_PATH_SUFFIXES = [
    '/trial/reactivate',
    '/trial/reactivate-subscription',
    '/checkout',
    '/subscriptions/reactivate'
] as const;

/**
 * Response header name for communicating remaining grace period days to clients.
 *
 * @example
 * ```
 * X-Grace-Period-Days-Remaining: 2
 * ```
 */
const GRACE_DAYS_HEADER = 'X-Grace-Period-Days-Remaining';

/**
 * Resolves the most urgent past-due subscription for a given billing customer.
 *
 * Fetches all subscriptions and returns the past-due one with the fewest
 * grace days remaining (most urgent). When multiple past-due subscriptions
 * exist, the one closest to (or most beyond) grace expiry controls access.
 * Returns `null` if the customer has no past-due subscription.
 *
 * @param customerId - QZPay billing customer identifier
 * @returns The most urgent past-due subscription with helpers, or `null`
 */
async function findPastDueSubscription(
    customerId: string
): Promise<QZPaySubscriptionWithHelpers | null> {
    const billing = getQZPayBilling();

    if (!billing) {
        return null;
    }

    const subscriptions = await billing.subscriptions.getByCustomerId(customerId);

    const pastDueSubs = subscriptions.filter((sub) => sub.isPastDue());
    if (pastDueSubs.length === 0) return null;
    if (pastDueSubs.length === 1) return pastDueSubs[0] ?? null;

    // Multiple past_due: use the one with fewest grace days remaining (most urgent)
    return pastDueSubs.reduce((mostUrgent, current) => {
        const urgentDays = mostUrgent.daysRemainingInGrace() ?? 0;
        const currentDays = current.daysRemainingInGrace() ?? 0;
        return currentDays < urgentDays ? current : mostUrgent;
    });
}

/**
 * Past-due grace period middleware factory.
 *
 * Checks whether an authenticated user's subscription is in `past_due` status
 * and, if so, enforces the grace period window. Requests are blocked with
 * **402 Payment Required** once the grace period has expired.
 *
 * Must run AFTER:
 * - `billingMiddleware` (sets `billingEnabled` and `qzpay` on context)
 * - `billingCustomerMiddleware` (sets `billingCustomerId` on context)
 *
 * @returns Hono middleware handler bound to `AppBindings`
 *
 * @example
 * ```typescript
 * import { pastDueGraceMiddleware } from './middlewares/past-due-grace.middleware';
 *
 * // Apply globally after billing middlewares
 * app.use('*', billingMiddleware);
 * app.use('*', billingCustomerMiddleware());
 * app.use('*', pastDueGraceMiddleware());
 *
 * // Or apply selectively on protected routes
 * app.use('/api/v1/protected/*', pastDueGraceMiddleware());
 * ```
 */
export function pastDueGraceMiddleware(): AppMiddleware {
    return async (c, next) => {
        // Skip if billing is not enabled in this environment
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            await next();
            return;
        }

        // Skip if the request is not associated with a billing customer
        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            await next();
            return;
        }

        // Allow recovery paths through even when grace period has expired
        const requestPath = c.req.path;
        const isExemptPath = GRACE_EXEMPT_PATH_SUFFIXES.some((suffix) =>
            requestPath.endsWith(suffix)
        );
        if (isExemptPath) {
            await next();
            return;
        }

        try {
            const pastDueSub = await findPastDueSubscription(billingCustomerId);

            // No past-due subscription found - pass through normally
            if (!pastDueSub) {
                await next();
                return;
            }

            const isInGrace = pastDueSub.isInGracePeriod();

            if (isInGrace) {
                // Grace period is active: allow the request but inform the client
                const daysRemaining = pastDueSub.daysRemainingInGrace() ?? 0;

                c.header(GRACE_DAYS_HEADER, String(daysRemaining));

                apiLogger.warn(
                    {
                        customerId: billingCustomerId,
                        subscriptionId: pastDueSub.id,
                        daysRemaining,
                        path: c.req.path
                    },
                    'Request allowed within past-due grace period'
                );

                await next();
                return;
            }

            // Grace period has expired: calculate how many days overdue
            const daysOverdue = Math.abs(pastDueSub.daysRemainingInGrace() ?? 0);

            apiLogger.warn(
                {
                    customerId: billingCustomerId,
                    subscriptionId: pastDueSub.id,
                    daysOverdue,
                    path: c.req.path
                },
                'Blocked request: grace period expired'
            );

            return c.json(
                {
                    error: 'GRACE_PERIOD_EXPIRED',
                    message:
                        'Your grace period has expired. Please update your payment method to continue.',
                    daysOverdue
                },
                402
            );
        } catch (error) {
            // Log unexpected errors but do not block the request (fail open)
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    customerId: billingCustomerId,
                    path: c.req.path,
                    error: errorMessage
                },
                'Unexpected error in past-due grace middleware - allowing request'
            );

            await next();
        }
    };
}

/**
 * Plan Change Routes
 *
 * API endpoint for changing subscription plans (upgrades/downgrades).
 * Provides plan change functionality with proration handling.
 *
 * Routes:
 * - POST /api/v1/protected/billing/subscriptions/change-plan - Change subscription plan (authenticated)
 *
 * @remarks
 * **BILL-13 Decision (v1):** Plan changes are only supported for active subscriptions.
 * Canceled or expired subscriptions cannot be reactivated through a plan change.
 * Users in those states must contact support for manual reactivation before changing plans.
 *
 * @module routes/billing/plan-change
 */

import { billingSubscriptionEvents, getDb } from '@repo/db';
import { BillingIntervalEnum } from '@repo/schemas';
import { PlanChangeRequestSchema, PlanChangeResponseSchema } from '@repo/schemas';
import { BILLING_EVENT_TYPES, withServiceTransaction } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import { getQZPayBilling } from '../../middlewares/billing';
import { clearEntitlementCache } from '../../middlewares/entitlement';
import { handlePlanChangeAddonRecalculation } from '../../services/addon-plan-change.service';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { type SimpleRouteInterface, createSimpleRoute } from '../../utils/route-factory';

/**
 * Mapped QZPay interval with count for multi-month periods.
 */
interface QZPayIntervalMapping {
    /** QZPay interval unit */
    readonly interval: 'month' | 'year' | 'week' | 'day';
    /** Number of interval units per billing period (e.g., 3 for quarterly) */
    readonly intervalCount: number;
}

/**
 * Map BillingIntervalEnum to QZPay interval format with count.
 *
 * QZPay uses 'month' | 'year' with an optional count, while our enum
 * uses 'monthly' | 'annual' | 'quarterly' | 'semi_annual'.
 *
 * @param interval - Hospeda billing interval enum value
 * @returns QZPay interval unit and count
 */
/**
 * Supported billing interval values for plan changes.
 * Used to validate interval before mapping to QZPay format.
 */
const SUPPORTED_INTERVALS = new Set(['monthly', 'annual', 'quarterly', 'semi_annual', 'one_time']);

function mapBillingIntervalToQZPay(interval: BillingIntervalEnum): QZPayIntervalMapping {
    const intervalStr = interval as string;

    if (!SUPPORTED_INTERVALS.has(intervalStr)) {
        throw new HTTPException(422, {
            message: `Unsupported billing interval '${intervalStr}'. Supported intervals: ${[...SUPPORTED_INTERVALS].join(', ')}`
        });
    }

    switch (intervalStr) {
        case 'monthly':
            return { interval: 'month', intervalCount: 1 };
        case 'annual':
            return { interval: 'year', intervalCount: 1 };
        case 'quarterly':
            return { interval: 'month', intervalCount: 3 };
        case 'semi_annual':
            return { interval: 'month', intervalCount: 6 };
        case 'one_time':
            return { interval: 'month', intervalCount: 1 };
        default:
            throw new HTTPException(422, {
                message: `Unsupported billing interval '${intervalStr}'. Supported intervals: ${[...SUPPORTED_INTERVALS].join(', ')}`
            });
    }
}

/**
 * Handler for changing subscription plans
 * Extracted for testability
 *
 * @param c - Hono context
 * @returns Plan change response with status and proration details
 * @throws HTTPException 503 if billing not configured
 * @throws HTTPException 400 if no billing account found or validation fails
 * @throws HTTPException 404 if subscription or target plan not found
 * @throws HTTPException 500 if service fails
 */
export const handlePlanChange = async (c: Parameters<SimpleRouteInterface['handler']>[0]) => {
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

    // Parse and validate request body
    const body = await c.req.json();
    const parseResult = PlanChangeRequestSchema.safeParse(body);

    if (!parseResult.success) {
        throw new HTTPException(400, {
            message: 'Invalid request body',
            cause: parseResult.error.flatten()
        });
    }

    const { newPlanId, billingInterval } = parseResult.data;

    const billing = getQZPayBilling();

    if (!billing) {
        throw new HTTPException(503, {
            message: 'Billing service is not available'
        });
    }

    try {
        // 1. Get user's active subscription
        const subscriptions = await billing.subscriptions.getByCustomerId(billingCustomerId);
        const activeSubscription = subscriptions.find(
            (sub) => sub.status === 'active' || sub.status === 'trialing'
        );

        if (!activeSubscription) {
            throw new HTTPException(404, {
                message: 'No active subscription found'
            });
        }

        // 2. Get target plan details
        const targetPlan = await billing.plans.get(newPlanId);

        if (!targetPlan) {
            throw new HTTPException(404, {
                message: `Target plan '${newPlanId}' not found`
            });
        }

        // 3. Reject one_time billing interval (uses a separate payment flow)
        if (billingInterval === BillingIntervalEnum.ONE_TIME) {
            throw new HTTPException(422, {
                message:
                    'One-time plans cannot be used for subscription plan changes. Use the purchase flow instead.'
            });
        }

        // 4. Check if user is trying to change to the same plan
        if (activeSubscription.planId === newPlanId) {
            throw new HTTPException(400, {
                message: 'Cannot change to the same plan'
            });
        }

        // 5. Get current plan to compare prices
        const currentPlan = await billing.plans.get(activeSubscription.planId);

        if (!currentPlan) {
            throw new HTTPException(404, {
                message: 'Current plan not found'
            });
        }

        // 6. Find the price matching the requested billing interval
        // Map our enum to QZPay's interval format (includes intervalCount for quarterly/semi_annual)
        const { interval: qzpayInterval, intervalCount: qzpayIntervalCount } =
            mapBillingIntervalToQZPay(billingInterval);

        const targetPrice = targetPlan.prices.find(
            (p) =>
                p.billingInterval === qzpayInterval && (p.intervalCount ?? 1) === qzpayIntervalCount
        );

        if (!targetPrice) {
            throw new HTTPException(400, {
                message: `No price found for billing interval '${billingInterval}'`
            });
        }

        // 7. Get current subscription interval and find matching price from current plan
        const currentInterval = activeSubscription.interval;

        const currentPrice = currentPlan.prices.find((p) => p.billingInterval === currentInterval);

        if (!currentPrice) {
            throw new HTTPException(400, {
                message: 'Current plan price not found'
            });
        }

        // 8. Determine if this is an upgrade or downgrade
        // Normalize prices by intervalCount so multi-month plans are comparable
        // e.g., "6 months at $600" -> $100/month vs "1 month at $120" -> $120/month
        const currentIntervalCount = currentPrice.intervalCount ?? 1;
        const targetIntervalCount = targetPrice.intervalCount ?? 1;
        const normalizedCurrentPrice = currentPrice.unitAmount / currentIntervalCount;
        const normalizedTargetPrice = targetPrice.unitAmount / targetIntervalCount;
        const isUpgrade = normalizedTargetPrice > normalizedCurrentPrice;

        // 9. Capture oldPlanId BEFORE changePlan() mutates the subscription record
        const oldPlanId = activeSubscription.planId;

        // 10. Change the plan with appropriate proration behavior
        const result = await billing.subscriptions.changePlan(activeSubscription.id, {
            newPlanId,
            newPriceId: targetPrice.id,
            prorationBehavior: isUpgrade ? 'create_prorations' : 'none',
            applyAt: isUpgrade ? 'immediately' : 'period_end'
        });

        // 11. Recalculate addon limits for the new plan (Flow B — AC-3.8).
        //     This is the PRIMARY trigger. Runs after QZPay confirms the plan change.
        //     Failures are logged and non-blocking: the plan change already succeeded.
        //
        //     NOTE: billing.subscriptions.changePlan() (step 10) is an external API call
        //     to QZPay and cannot be rolled back via SQL transaction. Only the local DB
        //     operations (addon recalculation) are wrapped in withServiceTransaction so
        //     partial local writes are atomically rolled back on failure.
        //
        // SPEC-064 OP-2: If local transaction fails after QZPay plan change succeeds,
        // we log a PLAN_CHANGE_LOCAL_FAILED compensating event. The webhook safety net
        // in subscription-logic.ts provides eventual consistency — when QZPay sends
        // subsequent webhooks, the handlers reconcile local DB state with QZPay state.
        const subscriptionId = result.subscription.id;
        try {
            await withServiceTransaction(async (ctx) => {
                await handlePlanChangeAddonRecalculation({
                    customerId: billingCustomerId,
                    oldPlanId,
                    newPlanId,
                    billing,
                    // ctx.tx is always defined inside withServiceTransaction
                    // biome-ignore lint/style/noNonNullAssertion: tx is guaranteed by withServiceTransaction
                    db: ctx.tx!
                });
            });
        } catch (recalcError) {
            const recalcMessage =
                recalcError instanceof Error ? recalcError.message : String(recalcError);

            // Log compensating event OUTSIDE the (now rolled-back) transaction.
            // This insert uses the top-level db connection so it persists even though
            // the local transaction failed.
            const db = getDb();
            await db.insert(billingSubscriptionEvents).values({
                subscriptionId,
                eventType: BILLING_EVENT_TYPES.PLAN_CHANGE_LOCAL_FAILED,
                triggerSource: 'plan-change-compensating',
                metadata: {
                    oldPlanId,
                    newPlanId,
                    error: recalcMessage,
                    timestamp: new Date().toISOString()
                }
            });

            // Don't re-throw — the QZPay plan change already succeeded.
            // The webhook safety net provides eventual consistency.
            apiLogger.error(
                {
                    customerId: billingCustomerId,
                    subscriptionId,
                    oldPlanId,
                    newPlanId,
                    error: recalcMessage
                },
                'Plan change local transaction failed, compensating event logged'
            );
        }

        // 12. Map to response format
        const response: {
            subscriptionId: string;
            previousPlanId: string;
            newPlanId: string;
            effectiveAt: string;
            proratedAmount?: number;
            status: 'active' | 'scheduled';
        } = {
            subscriptionId: result.subscription.id,
            previousPlanId: oldPlanId,
            newPlanId,
            effectiveAt: result.proration?.effectiveDate
                ? result.proration.effectiveDate.toISOString()
                : new Date().toISOString(),
            status: isUpgrade ? 'active' : 'scheduled'
        };

        // Add prorated amount only for upgrades
        if (isUpgrade && result.proration) {
            response.proratedAmount = result.proration.chargeAmount - result.proration.creditAmount;
        }

        // Clear entitlement cache to reflect plan change immediately
        clearEntitlementCache(billingCustomerId);

        return response;
    } catch (error) {
        // Re-throw HTTP exceptions as-is
        if (error instanceof HTTPException) {
            throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            {
                customerId: billingCustomerId,
                newPlanId,
                billingInterval,
                error: errorMessage
            },
            'Failed to change subscription plan'
        );

        throw new HTTPException(500, {
            message: 'Failed to change plan. Please try again or contact support.'
        });
    }
};

/**
 * POST /api/v1/protected/billing/subscriptions/change-plan
 * Change subscription plan (authenticated)
 *
 * This endpoint changes the user's subscription plan with automatic
 * proration handling:
 * - Upgrades: Applied immediately with proration
 * - Downgrades: Scheduled for end of billing period
 */
export const changePlanRoute = createSimpleRoute({
    method: 'post',
    path: '/change-plan',
    summary: 'Change subscription plan',
    description:
        'Change subscription plan with automatic proration. Upgrades apply immediately, downgrades at period end.',
    tags: ['Billing', 'Subscriptions'],
    responseSchema: PlanChangeResponseSchema,
    handler: handlePlanChange
});

/**
 * Plan change routes router
 */
const planChangeRouter = createRouter();

planChangeRouter.route('/', changePlanRoute);

export { planChangeRouter };

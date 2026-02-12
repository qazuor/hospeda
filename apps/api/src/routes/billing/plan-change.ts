/**
 * Plan Change Routes
 *
 * API endpoint for changing subscription plans (upgrades/downgrades).
 * Provides plan change functionality with proration handling.
 *
 * Routes:
 * - POST /api/v1/billing/subscriptions/change-plan - Change subscription plan (authenticated)
 *
 * @module routes/billing/plan-change
 */

import type { BillingIntervalEnum } from '@repo/schemas';
import { PlanChangeRequestSchema, PlanChangeResponseSchema } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { getQZPayBilling } from '../../middlewares/billing';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { type SimpleRouteInterface, createSimpleRoute } from '../../utils/route-factory';

/**
 * Map BillingIntervalEnum to QZPay interval format
 * QZPay uses 'month' | 'year', while our enum uses 'monthly' | 'annual'
 */
function mapBillingIntervalToQZPay(
    interval: BillingIntervalEnum
): 'month' | 'year' | 'week' | 'day' {
    const intervalStr = interval as string;

    switch (intervalStr) {
        case 'monthly':
            return 'month';
        case 'annual':
            return 'year';
        case 'quarterly':
            // Map quarterly to month with interval count (handled elsewhere)
            return 'month';
        case 'semi_annual':
            // Map semi-annual to month with interval count (handled elsewhere)
            return 'month';
        case 'one_time':
            // One-time payments could be treated as a single month
            return 'month';
        default:
            // Fallback
            return 'month';
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

        // 3. Check if user is trying to change to the same plan
        if (activeSubscription.planId === newPlanId) {
            throw new HTTPException(400, {
                message: 'Cannot change to the same plan'
            });
        }

        // 4. Get current plan to compare prices
        const currentPlan = await billing.plans.get(activeSubscription.planId);

        if (!currentPlan) {
            throw new HTTPException(404, {
                message: 'Current plan not found'
            });
        }

        // 5. Find the price matching the requested billing interval
        // Map our enum to QZPay's interval format
        const qzpayInterval = mapBillingIntervalToQZPay(billingInterval);

        const targetPrice = targetPlan.prices.find((p) => p.billingInterval === qzpayInterval);

        if (!targetPrice) {
            throw new HTTPException(400, {
                message: `No price found for billing interval '${billingInterval}'`
            });
        }

        // 6. Get current subscription interval and find matching price from current plan
        const currentInterval = activeSubscription.interval;

        const currentPrice = currentPlan.prices.find((p) => p.billingInterval === currentInterval);

        if (!currentPrice) {
            throw new HTTPException(400, {
                message: 'Current plan price not found'
            });
        }

        // 7. Determine if this is an upgrade or downgrade
        const isUpgrade = targetPrice.unitAmount > currentPrice.unitAmount;

        // 8. Change the plan with appropriate proration behavior
        const result = await billing.subscriptions.changePlan(activeSubscription.id, {
            newPlanId,
            newPriceId: targetPrice.id,
            prorationBehavior: isUpgrade ? 'create_prorations' : 'none',
            applyAt: isUpgrade ? 'immediately' : 'period_end'
        });

        // 9. Map to response format
        const response: {
            subscriptionId: string;
            previousPlanId: string;
            newPlanId: string;
            effectiveAt: string;
            proratedAmount?: number;
            status: 'active' | 'scheduled';
        } = {
            subscriptionId: result.subscription.id,
            previousPlanId: activeSubscription.planId,
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
 * POST /api/v1/billing/subscriptions/change-plan
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

export default planChangeRouter;

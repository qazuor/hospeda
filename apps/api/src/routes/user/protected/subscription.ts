/**
 * User subscription endpoint.
 * Returns the current billing subscription for the authenticated user.
 * @route GET /api/v1/protected/users/me/subscription
 */
import type { QZPaySubscriptionWithHelpers } from '@qazuor/qzpay-core';
import { PAYMENT_GRACE_PERIOD_DAYS, getPlanBySlug } from '@repo/billing';
import type { Context } from 'hono';
import { z } from 'zod';
import { getQZPayBilling } from '../../../middlewares/billing';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Allowed subscription status values */
const SUBSCRIPTION_STATUSES = [
    'active',
    'trial',
    'cancelled',
    'expired',
    'past_due',
    'pending'
] as const;

/** Maps QZPay subscription status values to our API status enum */
const QZPAY_STATUS_MAP: Record<string, (typeof SUBSCRIPTION_STATUSES)[number]> = {
    active: 'active',
    trialing: 'trial',
    trial: 'trial',
    canceled: 'cancelled',
    cancelled: 'cancelled',
    expired: 'expired',
    past_due: 'past_due',
    unpaid: 'expired',
    incomplete: 'pending',
    incomplete_expired: 'expired',
    paused: 'pending',
    pending: 'pending'
};

/** Response schema for user subscription */
const SubscriptionResponseSchema = z.object({
    subscription: z
        .object({
            planSlug: z.string(),
            planName: z.string(),
            status: z.enum(SUBSCRIPTION_STATUSES),
            currentPeriodStart: z.string().nullable(),
            currentPeriodEnd: z.string().nullable(),
            cancelAtPeriodEnd: z.boolean(),
            trialEndsAt: z.string().nullable(),
            monthlyPriceArs: z.number(),
            paymentMethod: z
                .object({
                    brand: z.string(),
                    last4: z.string(),
                    expMonth: z.number(),
                    expYear: z.number()
                })
                .nullable()
                .optional(),
            gracePeriodDaysRemaining: z.number().nullable().optional(),
            gracePeriodExpiresAt: z.string().nullable().optional()
        })
        .nullable()
});

/**
 * GET /api/v1/protected/users/me/subscription
 * Returns the current subscription details for the authenticated user.
 * If billing is disabled or the user has no subscription, returns { subscription: null }.
 */
export const userSubscriptionRoute = createProtectedRoute({
    method: 'get',
    path: '/me/subscription',
    summary: 'Get user subscription',
    description:
        'Returns the current billing subscription for the authenticated user including plan details and status.',
    tags: ['Users'],
    responseSchema: SubscriptionResponseSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        // Check if billing is enabled
        const billingEnabled = ctx.get('billingEnabled');

        if (!billingEnabled) {
            apiLogger.debug(
                { userId: actor.id },
                'Billing not enabled, returning null subscription'
            );
            return { subscription: null };
        }

        const billing = getQZPayBilling();

        if (!billing) {
            apiLogger.debug(
                { userId: actor.id },
                'Billing service unavailable, returning null subscription'
            );
            return { subscription: null };
        }

        // Look up the billing customer by user ID (externalId)
        let customer: { id: string } | null = null;

        try {
            customer = await billing.customers.getByExternalId(actor.id);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            apiLogger.warn(
                { userId: actor.id, error: errorMessage },
                'Failed to look up billing customer'
            );
            return { subscription: null };
        }

        if (!customer) {
            apiLogger.debug(
                { userId: actor.id },
                'No billing customer found for user, returning null subscription'
            );
            return { subscription: null };
        }

        // Retrieve subscriptions for the customer (with helper methods)
        let subscriptions: QZPaySubscriptionWithHelpers[] = [];

        try {
            subscriptions = await billing.subscriptions.getByCustomerId(customer.id);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            apiLogger.warn(
                { userId: actor.id, customerId: customer.id, error: errorMessage },
                'Failed to retrieve subscriptions for billing customer'
            );
            return { subscription: null };
        }

        if (!subscriptions || subscriptions.length === 0) {
            apiLogger.debug(
                { userId: actor.id, customerId: customer.id },
                'No subscriptions found for billing customer'
            );
            return { subscription: null };
        }

        // Find the most recent active, trial, or past_due subscription
        const activeSubscription = subscriptions.find(
            (sub) =>
                sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due'
        );

        if (!activeSubscription) {
            apiLogger.debug(
                { userId: actor.id, customerId: customer.id },
                'No active or trial subscription found for billing customer'
            );
            return { subscription: null };
        }

        // Resolve the plan slug via QZPay plan lookup
        let resolvedPlanSlug = activeSubscription.planId;

        try {
            const plan = await billing.plans.get(activeSubscription.planId);
            if (plan?.name) {
                resolvedPlanSlug = plan.name;
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            apiLogger.warn(
                { planId: activeSubscription.planId, error: errorMessage },
                'Failed to retrieve plan details, falling back to planId as slug'
            );
        }

        // Resolve plan display name and price from @repo/billing ALL_PLANS
        const planDefinition = getPlanBySlug(resolvedPlanSlug);
        const planName = planDefinition?.name ?? resolvedPlanSlug;
        const monthlyPriceArs = planDefinition?.monthlyPriceArs ?? 0;

        // Map QZPay status to our API status enum
        const mappedStatus: (typeof SUBSCRIPTION_STATUSES)[number] =
            QZPAY_STATUS_MAP[activeSubscription.status] ?? 'pending';

        // Safely convert Date or string to ISO string, or null
        const toIsoString = (value: Date | string | null | undefined): string | null => {
            if (!value) return null;
            if (value instanceof Date) return value.toISOString();
            return new Date(value).toISOString();
        };

        // Compute grace period info for past_due subscriptions.
        // QZPay is the source of truth for grace period calculation.
        // See: docs/billing/grace-period-source-of-truth.md
        let gracePeriodDaysRemaining: number | null = null;
        let gracePeriodExpiresAt: string | null = null;

        if (mappedStatus === 'past_due' && typeof activeSubscription.isPastDue === 'function') {
            try {
                const daysRemaining = activeSubscription.daysRemainingInGrace() ?? 0;
                gracePeriodDaysRemaining = Math.max(0, daysRemaining);

                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + gracePeriodDaysRemaining);
                gracePeriodExpiresAt = expiresAt.toISOString();

                apiLogger.debug(
                    {
                        userId: actor.id,
                        customerId: customer.id,
                        gracePeriodDaysRemaining,
                        referenceGraceDays: PAYMENT_GRACE_PERIOD_DAYS
                    },
                    'Computed grace period info for past_due subscription'
                );
            } catch (graceError) {
                apiLogger.warn(
                    {
                        userId: actor.id,
                        error: graceError instanceof Error ? graceError.message : String(graceError)
                    },
                    'Failed to compute grace period info'
                );
            }
        }

        return {
            subscription: {
                planSlug: resolvedPlanSlug,
                planName,
                status: mappedStatus,
                currentPeriodStart: toIsoString(activeSubscription.currentPeriodStart),
                currentPeriodEnd: toIsoString(activeSubscription.currentPeriodEnd),
                cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd ?? false,
                trialEndsAt: toIsoString(activeSubscription.trialEnd),
                monthlyPriceArs,
                paymentMethod: null,
                gracePeriodDaysRemaining,
                gracePeriodExpiresAt
            }
        };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});

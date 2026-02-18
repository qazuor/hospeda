/**
 * User subscription endpoint.
 * Returns the current billing subscription for the authenticated user.
 * @route GET /api/v1/protected/users/me/subscription
 */
import { getPlanBySlug } from '@repo/billing';
import type { Context } from 'hono';
import { z } from 'zod';
import { getQZPayBilling } from '../../../middlewares/billing';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

/** Allowed subscription status values */
const SUBSCRIPTION_STATUSES = ['active', 'trial', 'cancelled', 'expired', 'pending'] as const;

/** Maps QZPay subscription status values to our API status enum */
const QZPAY_STATUS_MAP: Record<string, (typeof SUBSCRIPTION_STATUSES)[number]> = {
    active: 'active',
    trialing: 'trial',
    trial: 'trial',
    canceled: 'cancelled',
    cancelled: 'cancelled',
    expired: 'expired',
    past_due: 'expired',
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
            monthlyPriceArs: z.number()
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

        // Retrieve subscriptions for the customer
        let subscriptions: {
            id: string;
            planId: string;
            status: string;
            currentPeriodStart?: Date | string | null;
            currentPeriodEnd?: Date | string | null;
            cancelAtPeriodEnd?: boolean | null;
            trialStart?: Date | string | null;
            trialEnd?: Date | string | null;
        }[] = [];

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

        // Find the most recent active or trial subscription
        const activeSubscription = subscriptions.find(
            (sub) => sub.status === 'active' || sub.status === 'trialing' || sub.status === 'trial'
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

        return {
            subscription: {
                planSlug: resolvedPlanSlug,
                planName,
                status: mappedStatus,
                currentPeriodStart: toIsoString(activeSubscription.currentPeriodStart),
                currentPeriodEnd: toIsoString(activeSubscription.currentPeriodEnd),
                cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd ?? false,
                trialEndsAt: toIsoString(activeSubscription.trialEnd),
                monthlyPriceArs
            }
        };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});

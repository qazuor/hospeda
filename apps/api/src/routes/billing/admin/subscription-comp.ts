/**
 * Admin Subscription Comp Route (HOS-1171)
 *
 * POST /api/v1/admin/billing/subscriptions/grant-comp
 *
 * Grants a permanently-complimentary (`status='comp'`) subscription to a
 * customer: full entitlements of the named plan, no MercadoPago preapproval, no
 * charge, ever.
 *
 * ## Why this route exists
 *
 * It did not, and that was the problem. `createCompSubscription` had exactly two
 * callers, both branches of `/start-paid`, so the ONLY way to produce a comp
 * subscription was for someone to redeem a `comp` promo code at the self-serve
 * checkout — a `createCRUDRoute` with no `requiredPermissions`, no `livemode`
 * filter, and `HOSPEDA_FREE` sitting active and uncapped in production. The two
 * comp subscriptions live in production were created exactly that way.
 *
 * HOS-1171 closes that door (`services/subscription-checkout-promo.service.ts`
 * refuses the effect) and retires the code itself from the seed. This route is
 * the replacement, and closing the door without it would have left `comp`
 * unreachable for the owner too.
 *
 * Modelled on `subscription-courtesy.ts` — same admin tier, same
 * `BILLING_MANAGE` permission, same schema and error-mapping style. The two are
 * siblings by design: courtesy gifts N cycles to someone who pays, comp gifts
 * the subscription outright, and NEITHER is reachable by redeeming a code.
 *
 * Per the API error contract: a plan that cannot be comped is **422** (the
 * request is well-formed, the plan is the problem), an unknown customer or plan
 * is **404**, and an actor without `BILLING_MANAGE` never reaches the handler.
 *
 * @module routes/billing/admin/subscription-comp
 */

import { and, billingCustomers, eq, getDb, isNull } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../../middlewares/actor';
import { createCompSubscription } from '../../../services/subscription-comp-create.service.js';
import { createRouter } from '../../../utils/create-app';
import { env } from '../../../utils/env.js';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * Body schema for the grant-comp endpoint.
 *
 * There is deliberately NO promo-code field. A comp is a plain administrative
 * act now; `createCompSubscription` still accepts an optional code for
 * provenance, but nothing in the product asks an operator for one, and adding a
 * field with no consumer would only invite someone to wire a code back in.
 */
export const AdminGrantCompBodySchema = z.object({
    /** The billing customer (qzpay `billing_customers.id`) receiving the grant. */
    customerId: z
        .string({ message: 'customerId must be a string' })
        .uuid({ message: 'customerId must be a valid UUID' }),
    /** The plan (`billing_plans.id`) whose entitlements are granted. */
    planId: z
        .string({ message: 'planId must be a string' })
        .uuid({ message: 'planId must be a valid UUID' }),
    /**
     * Recorded on the row for audit only — a comp is never charged, so the
     * interval changes nothing about what the customer pays (nothing).
     */
    interval: z.enum(['monthly', 'annual']).default('monthly')
});

/** Response for a successful comp grant. */
const AdminGrantCompResponseSchema = z.object({
    /** UUID of the freshly-created `status='comp'` subscription. */
    subscriptionId: z.string().uuid(),
    /** The customer it belongs to. */
    customerId: z.string().uuid(),
    /** The plan whose entitlements were granted. */
    planId: z.string().uuid(),
    /** Always `'comp'` — the status the new row carries. */
    status: z.literal('comp')
});

/**
 * POST /api/v1/admin/billing/subscriptions/grant-comp
 */
export const adminGrantCompRoute = createAdminRoute({
    method: 'post',
    path: '/grant-comp',
    summary: 'Grant a permanently-complimentary subscription (admin)',
    description:
        'Creates a status=comp subscription for a customer on the named plan: full entitlements, ' +
        'no MercadoPago preapproval, never charged. Only accommodation-domain plans can be ' +
        'comped. This is the ONLY way to produce a comp subscription — no promo code grants one. ' +
        'Requires BILLING_MANAGE.',
    tags: ['Billing', 'Subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestBody: AdminGrantCompBodySchema,
    responseSchema: AdminGrantCompResponseSchema,
    successStatusCode: 201,
    options: {
        // A write with billing side-effects: same stricter limit its sibling
        // `grant-courtesy` uses.
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c, _params, body) => {
        const actor = getActorFromContext(c);
        const { customerId, planId, interval } = body as {
            customerId: string;
            planId: string;
            interval: 'monthly' | 'annual';
        };

        apiLogger.info({ customerId, planId, interval, actorId: actor.id }, 'Admin granting comp');

        // Existence check BEFORE the service, so an unknown customer is a 404
        // and not the foreign-key violation the insert would otherwise raise —
        // which would surface as a 500 for what is plainly a caller mistake
        // (`docs/error-contract.md` R1: a 4xx is never INTERNAL_ERROR).
        const [customer] = await getDb()
            .select({ id: billingCustomers.id })
            .from(billingCustomers)
            .where(and(eq(billingCustomers.id, customerId), isNull(billingCustomers.deletedAt)))
            .limit(1);

        if (!customer) {
            throw new HTTPException(404, { message: 'Billing customer not found' });
        }

        try {
            const result = await createCompSubscription({
                customerId,
                planId,
                interval,
                livemode: env.NODE_ENV === 'production'
            });

            apiLogger.info(
                {
                    subscriptionId: result.localSubscriptionId,
                    customerId,
                    planId,
                    actorId: actor.id
                },
                'Comp subscription granted'
            );

            return {
                subscriptionId: result.localSubscriptionId,
                customerId,
                planId,
                status: 'comp' as const
            };
        } catch (error) {
            // The service signals both of its refusals by throwing (it predates
            // the Result convention its siblings use): a plan that does not
            // exist, and a plan whose `product_domain` is not accommodation —
            // the entitlement engine only ever counts accommodation subs, so
            // comping a gastronomy plan would grant nothing.
            const message = error instanceof Error ? error.message : String(error);

            if (message.includes('not found')) {
                throw new HTTPException(404, { message: `Plan '${planId}' not found` });
            }
            if (message.includes('only accommodation plans can be comped')) {
                throw new HTTPException(422, {
                    message: 'Only accommodation-domain plans can be comped'
                });
            }

            apiLogger.error({ customerId, planId, error: message }, 'Comp grant failed');
            throw new HTTPException(500, { message: 'Failed to grant comp subscription' });
        }
    }
});

/**
 * Admin subscription comp sub-router.
 *
 * Mounted under `/subscriptions` by `apps/api/src/routes/billing/admin/index.ts`.
 */
export const adminSubscriptionCompRouter = createRouter();
adminSubscriptionCompRouter.route('/', adminGrantCompRoute);

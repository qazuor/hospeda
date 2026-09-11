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
 * ## The half that is NOT in this file
 *
 * A comp used to arrive at NEW-SUBSCRIBER checkout, before any preapproval
 * existed. An admin grant arrives at an arbitrary moment, so the customer may
 * have one MercadoPago is actively charging — and granting a comp on top of it
 * means billing someone we have just declared free. Retiring those
 * subscriptions, hard-cancelling their preapprovals and ABORTING when
 * MercadoPago refuses lives in `services/subscription-comp-grant.service.ts`,
 * which this handler calls instead of `createCompSubscription`. Read that
 * module before changing anything here.
 *
 * Per the API error contract: a plan that cannot be comped is **422** (the
 * request is well-formed, the plan is the problem), an unknown customer or plan
 * is **404**, a MercadoPago refusal is **502**, and an actor without
 * `BILLING_MANAGE` never reaches the handler.
 *
 * @module routes/billing/admin/subscription-comp
 */

import { and, billingCustomers, eq, getDb, isNull } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../../middlewares/actor';
import {
    type GrantCompErrorCode,
    grantCompSubscription
} from '../../../services/subscription-comp-grant.service.js';
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
    status: z.literal('comp'),
    /**
     * Subscriptions retired to make room for the comp, with their MercadoPago
     * preapprovals hard-cancelled. Empty for a customer who was not subscribed.
     */
    supersededSubscriptionIds: z.array(z.string().uuid()),
    /** True when at least one live preapproval was hard-cancelled. */
    hadActiveBilling: z.boolean()
});

/**
 * Maps the service's typed failures onto HTTP status codes.
 *
 * `PROVIDER_ERROR` is a **502**, matching `grant-courtesy`: the request was
 * fine and so was the plan — MercadoPago refused, or could not be reached at
 * all, and the remedy is to retry rather than to change the request.
 *
 * `ALREADY_COMPED` is a **409**, not a 422: the request is perfectly valid and
 * would have been accepted a moment earlier. What refuses it is the current
 * state of the resource, which is exactly what 409 means.
 */
function mapErrorToStatus(code: GrantCompErrorCode): 404 | 409 | 422 | 502 {
    switch (code) {
        case 'NOT_FOUND':
            return 404;
        case 'ALREADY_COMPED':
            return 409;
        case 'PROVIDER_ERROR':
            return 502;
        default:
            return 422;
    }
}

/**
 * POST /api/v1/admin/billing/subscriptions/grant-comp
 */
export const adminGrantCompRoute = createAdminRoute({
    method: 'post',
    path: '/grant-comp',
    summary: 'Grant a permanently-complimentary subscription (admin)',
    description:
        'Creates a status=comp subscription for a customer on the named plan: full entitlements, ' +
        'no MercadoPago preapproval, never charged. The plan may belong to any vertical — the ' +
        "grant is scoped to that plan's product_domain, so only subscriptions in the SAME " +
        'vertical are touched. Every such subscription that could still be charged is cancelled ' +
        'first and its MercadoPago preapproval hard-cancelled; if MercadoPago refuses, or cannot ' +
        'be reached, the grant is aborted (502) rather than leaving a comped customer still being ' +
        'billed — retry, it resumes and skips whatever was already closed. A customer who already ' +
        'has a comp IN THAT VERTICAL is refused (409): cancel the existing one first if the plan ' +
        'must change; a comp in a different vertical is left alone, so an owner can hold both an ' +
        'accommodation and a gastronomy courtesy. This is the ONLY way to produce a comp ' +
        'subscription — no promo code grants one. Requires BILLING_MANAGE.',
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

        // The grant service does the ordering that matters — hard-cancel the
        // customer's live preapprovals FIRST and abort if MercadoPago refuses —
        // so this handler never calls `createCompSubscription` directly.
        const result = await grantCompSubscription({
            customerId,
            planId,
            interval,
            livemode: env.NODE_ENV === 'production',
            actorId: actor.id
        });

        if (!result.success) {
            throw new HTTPException(mapErrorToStatus(result.error.code), {
                message: result.error.message
            });
        }

        apiLogger.info(
            {
                subscriptionId: result.data.subscriptionId,
                customerId,
                planId,
                supersededSubscriptionIds: result.data.supersededSubscriptionIds,
                hadActiveBilling: result.data.hadActiveBilling,
                actorId: actor.id
            },
            'Comp subscription granted'
        );

        return {
            subscriptionId: result.data.subscriptionId,
            customerId,
            planId,
            status: 'comp' as const,
            supersededSubscriptionIds: [...result.data.supersededSubscriptionIds],
            hadActiveBilling: result.data.hadActiveBilling
        };
    }
});

/**
 * Admin subscription comp sub-router.
 *
 * Mounted under `/subscriptions` by `apps/api/src/routes/billing/admin/index.ts`.
 */
export const adminSubscriptionCompRouter = createRouter();
adminSubscriptionCompRouter.route('/', adminGrantCompRoute);

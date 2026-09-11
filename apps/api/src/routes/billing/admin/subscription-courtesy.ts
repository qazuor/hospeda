/**
 * Admin Subscription Courtesy Route (HOS-180)
 *
 * POST /api/v1/admin/billing/subscriptions/:subscriptionId/grant-courtesy
 *
 * Gifts N free billing cycles to a subscriber who is already paying. The
 * subscription must be `active` — a trialing subscriber is not being charged
 * yet, so gifting them cycles is a trial extension and has its own endpoint.
 *
 * Modelled on `subscription-trial-extension.ts`: same admin tier, same
 * permission-plus-ownership shape, same error mapping.
 *
 * Per the API error contract: an ineligible subscription is **422**, and a
 * subscription owned by somebody else is **404, not 403** — a 403 would confirm
 * the id exists.
 *
 * @module routes/billing/admin/subscription-courtesy
 */

import { PermissionEnum } from '@repo/schemas';
import { assertSubscriptionOwnership } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getActorFromContext } from '../../../middlewares/actor';
import { getQZPayBilling } from '../../../middlewares/billing';
import {
    type GrantCourtesyErrorCode,
    grantCourtesyCycles
} from '../../../services/courtesy-grant.service.js';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * Body schema for the grant-courtesy endpoint.
 *
 * `cycles` has a lower bound of 1 and deliberately **no upper bound** (spec
 * OQ-5): the owner chose not to cap it, on the basis that the grant is an
 * audited admin action against a named subscription.
 */
export const AdminGrantCourtesyBodySchema = z.object({
    cycles: z
        .number({ message: 'cycles must be a number' })
        .int({ message: 'cycles must be a whole number of billing cycles' })
        .positive({ message: 'cycles must be at least 1' })
});

/** Response for a successful courtesy grant. */
const AdminGrantCourtesyResponseSchema = z.object({
    /** UUID of the gifted subscription. */
    subscriptionId: z.string().uuid(),
    /**
     * ISO 8601 instant the gift begins — the end of the period the subscriber
     * already paid for, NOT the moment of the grant.
     */
    courtesyStartsAt: z.string().datetime(),
    /** ISO 8601 instant the gift expires and normal billing resumes. */
    courtesyEndsAt: z.string().datetime(),
    /** Cycles gifted. */
    courtesyCyclesGranted: z.number().int().positive()
});

/**
 * Maps the service's typed failures onto HTTP status codes.
 *
 * `NOT_ENOUGH_LEAD_TIME` is a 422 rather than a 409: the request is well-formed
 * and the subscription is fine — it is the timing that makes it unprocessable,
 * and the message tells the admin to come back earlier in the period.
 */
function mapErrorToStatus(code: GrantCourtesyErrorCode): 404 | 422 | 502 {
    switch (code) {
        case 'NOT_FOUND':
            return 404;
        case 'PROVIDER_ERROR':
            return 502;
        default:
            return 422;
    }
}

/**
 * POST /api/v1/admin/billing/subscriptions/{subscriptionId}/grant-courtesy
 */
export const adminGrantCourtesyRoute = createAdminRoute({
    method: 'post',
    path: '/{subscriptionId}/grant-courtesy',
    summary: 'Gift free billing cycles to a paying subscriber (admin)',
    description:
        'Gifts N free billing cycles to an active subscription by pausing its MercadoPago ' +
        'preapproval for the duration. The subscriber keeps every entitlement, is not asked ' +
        'for their card again, and returns to full price automatically when the gift ends. ' +
        'The gift starts at the end of the period already paid for, not at the moment of the ' +
        'grant. Refused when the next charge is under three days away, because pausing that ' +
        'close may not stop it. Requires BILLING_MANAGE.',
    tags: ['Billing', 'Subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: {
        subscriptionId: z
            .string({ message: 'Subscription ID must be a string' })
            .uuid({ message: 'Subscription ID must be a valid UUID' })
    },
    requestBody: AdminGrantCourtesyBodySchema,
    responseSchema: AdminGrantCourtesyResponseSchema,
    // POST on an existing subscription → 200, not 201.
    successStatusCode: 200,
    options: {
        // A write with billing side-effects: same stricter limit its sibling uses.
        customRateLimit: { requests: 20, windowMs: 60_000 }
    },
    handler: async (c, params, body) => {
        const actor = getActorFromContext(c);
        const subscriptionId = params.subscriptionId as string;
        const { cycles } = body as { cycles: number };

        apiLogger.info(
            { subscriptionId, cycles, actorId: actor.id },
            'Admin granting courtesy cycles'
        );

        // Ownership guard, mirroring subscription-trial-extension.ts. An actor
        // with ACCESS_API_ADMIN bypasses it; anyone else may only act on a
        // subscription belonging to their own billing customer.
        const actorHasAdmin = actor.permissions?.includes(PermissionEnum.ACCESS_API_ADMIN) ?? false;

        if (!actorHasAdmin) {
            const billingCustomerId = c.get('billingCustomerId') as string | undefined | null;
            if (!billingCustomerId) {
                throw new HTTPException(403, {
                    message: 'Billing customer context required for non-admin actors'
                });
            }

            const ownership = await assertSubscriptionOwnership({
                subscriptionId,
                billingCustomerId,
                actorHasAdmin: false
            });

            if (!ownership.success) {
                // 404 for BOTH "missing" and "someone else's": a 403 here would
                // confirm the id exists (API error contract).
                throw new HTTPException(404, { message: 'Subscription not found' });
            }
        }

        const billing = getQZPayBilling();
        if (!billing) {
            // Billing is not configured in this environment. A 503 rather than a
            // 500: nothing is broken, the capability simply is not available.
            throw new HTTPException(503, { message: 'Billing service is not configured' });
        }

        const result = await grantCourtesyCycles({
            billing,
            subscriptionId,
            cycles,
            actorId: actor.id
        });

        if (!result.success) {
            throw new HTTPException(mapErrorToStatus(result.error.code), {
                message: result.error.message
            });
        }

        apiLogger.info(
            {
                subscriptionId,
                cycles: result.data.courtesyCyclesGranted,
                courtesyEndsAt: result.data.courtesyEndsAt.toISOString(),
                actorId: actor.id
            },
            'Courtesy cycles granted successfully'
        );

        return {
            subscriptionId: result.data.subscriptionId,
            courtesyStartsAt: result.data.courtesyStartsAt.toISOString(),
            courtesyEndsAt: result.data.courtesyEndsAt.toISOString(),
            courtesyCyclesGranted: result.data.courtesyCyclesGranted
        };
    }
});

/**
 * Admin subscription courtesy sub-router.
 *
 * Mounted under `/subscriptions` by `apps/api/src/routes/billing/admin/index.ts`.
 */
export const adminSubscriptionCourtesyRouter = createRouter();
adminSubscriptionCourtesyRouter.route('/', adminGrantCourtesyRoute);

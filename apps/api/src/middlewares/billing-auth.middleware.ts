/**
 * @file billing-auth.middleware.ts
 * @description Authentication middleware for billing routes.
 *
 * Extracted from `routes/billing/index.ts` (where it originally lived
 * inline) so it can be shared by BOTH the qzpay-hono wrapper (via
 * `createBillingRoutes({ authMiddleware })`) and Hospeda-custom routes that
 * bypass the qzpay wrapper entirely — e.g. the `GET /plans` override in
 * `routes/billing/protected-plans-list.ts` — without creating a circular
 * import between the two route files.
 *
 * @module middlewares/billing-auth
 */

import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { isGuestActor } from '../utils/actor';

/**
 * Authentication middleware for billing routes.
 * Compatible with QZPay's authMiddleware requirement.
 *
 * Accepts either `user` (set by better-auth session middleware in production)
 * or `actor` (set by actorMiddleware, which is the codebase-wide auth abstraction
 * and is also populated in test mode via HOSPEDA_ALLOW_MOCK_ACTOR). The two are
 * always set together in production; the dual check exists so test setups that
 * skip the session layer still pass through.
 */
export const billingAuthMiddleware: MiddlewareHandler = async (c, next) => {
    const user = c.get('user');
    const actor = c.get('actor');

    // A real session sets `user`; the actor abstraction sets `actor`. A GUEST
    // actor still carries a (sentinel) id, so checking `actor?.id` alone lets
    // unauthenticated requests through — guard against the guest explicitly.
    const authenticated = Boolean(user?.id) || (Boolean(actor?.id) && !isGuestActor(actor));

    if (!authenticated) {
        throw new HTTPException(401, {
            message: 'Authentication required for billing operations'
        });
    }

    await next();
};

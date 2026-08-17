/**
 * Auth middleware for the `@qazuor/qzpay-hono` admin tier mounted under
 * `/api/v1/admin/billing`.
 *
 * Enforces a base `BILLING_READ_ALL` permission for any request, plus stricter
 * permissions on write paths:
 *  - subscriptions {cancel,force-cancel,pause,resume,change-plan,extend-trial}:
 *    MANAGE_SUBSCRIPTIONS
 *  - payments/invoices write paths + entitlements/limits manage: BILLING_MANAGE
 *
 * Lives in its own module rather than inside `routes/billing/admin/index.ts`
 * so it can be exercised without mounting the qzpay tier — which needs a live
 * database — and so the 401-before-403 ordering below is covered by a test.
 *
 * @module middlewares/billing-admin-auth.middleware
 */

import { PermissionEnum } from '@repo/schemas';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext, isGuestActor } from '../utils/actor';

/**
 * Enforces authentication, then permission, for the qzpay admin tier.
 *
 * The order is the contract, not a detail: 401 means "I don't know who you
 * are" and sends the client to the login screen; 403 means "I know who you are
 * and it isn't enough" and shows a permissions message.
 */
export const billingAdminAuthMiddleware: MiddlewareHandler = async (c, next) => {
    const actor = getActorFromContext(c);

    // Anonymous callers get 401, never 403.
    //
    // This used to read `!actor?.id`, which never fires: the guest actor
    // carries a real UUID (`00000000-0000-4000-8000-000000000000`), so an
    // anonymous request fell through to the permission check below and came
    // back 403 (H-165). Sibling admin routes answer 401, and so does
    // `/admin/billing/plans` — it is served by `createAdminListRoute`, whose
    // native guard tests `isGuestActor`. The effect on a real person: an
    // administrator whose session expired opens Suscripciones, Pagos or
    // Clientes and is told they lack permissions, when all they need is to log
    // back in.
    if (isGuestActor(actor)) {
        throw new HTTPException(401, { message: 'Authentication required' });
    }

    const permissions: readonly string[] = actor.permissions ?? [];

    if (!permissions.includes(PermissionEnum.BILLING_READ_ALL)) {
        throw new HTTPException(403, { message: 'Admin billing access required' });
    }

    const method = c.req.method.toUpperCase();
    if (method !== 'GET') {
        const path = c.req.path;

        const isSubscriptionWrite =
            path.includes('/subscriptions/') &&
            (path.endsWith('/cancel') ||
                path.endsWith('/force-cancel') ||
                path.endsWith('/pause') ||
                path.endsWith('/resume') ||
                path.endsWith('/change-plan') ||
                path.endsWith('/extend-trial'));

        if (isSubscriptionWrite && !permissions.includes(PermissionEnum.MANAGE_SUBSCRIPTIONS)) {
            throw new HTTPException(403, {
                message: 'Subscription management permission required'
            });
        }

        const isMoneyMove =
            path.endsWith('/refund') ||
            path.endsWith('/force-refund') ||
            path.endsWith('/pay') ||
            path.endsWith('/mark-paid') ||
            path.endsWith('/void') ||
            path.includes('/entitlements') ||
            path.includes('/limits/');

        if (isMoneyMove && !permissions.includes(PermissionEnum.BILLING_MANAGE)) {
            throw new HTTPException(403, {
                message: 'Billing management permission required'
            });
        }
    }

    await next();
};

/**
 * Billing self-permission middleware (SPEC-156, T-007).
 *
 * Defense-in-depth perm check for `/api/v1/protected/billing/*` routes. Sits
 * alongside (NOT replacing) `billingOwnershipMiddleware` — that one enforces
 * "this resource belongs to you"; this one enforces "you carry the
 * BILLING_VIEW_OWN permission bit at all".
 *
 * Why both?
 *   - **Ownership** is a per-request, per-resource check (looks up the row
 *     and compares `customerId`). Cannot be revoked at the role level.
 *   - **Permission** is a per-user gate (role bundle assignment from
 *     `rolePermissions.seed.ts`). Lets us revoke self-billing for a user
 *     without removing them from the HOST role.
 *
 * Boundary with SPEC-164: admin billing routes (`/api/v1/admin/billing/*`)
 * continue to gate on `BILLING_READ_ALL` / `BILLING_MANAGE` (SUPER_ADMIN-only
 * post-SPEC-164). Granting a HOST `BILLING_VIEW_OWN` does NOT widen their
 * access to admin billing — those routes are mounted on a different path
 * with different middleware. This middleware ONLY applies to
 * `/protected/billing/*`.
 *
 * 401 vs 403:
 *   - Unauthenticated (guest, no actor): pass through. `billingAuthMiddleware`
 *     already rejects with 401 upstream. We never see those requests.
 *   - Authenticated but lacks `BILLING_VIEW_OWN`: 403 Forbidden.
 *
 * @module middlewares/billing-perm.middleware
 */

import { PermissionEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import type { AppMiddleware } from '../types';
import { isGuestActor } from '../utils/actor';
import { apiLogger } from '../utils/logger';

/**
 * Creates the billing-self-permission middleware.
 *
 * Defaults to gating on `BILLING_VIEW_OWN`. Callers can pass a different
 * permission for narrower sub-routes (e.g. `SUBSCRIPTION_VIEW_OWN` on a
 * subscription-only sub-router), though SPEC-156 V1 only uses the default
 * on the billing root.
 */
export function billingPermMiddleware(
    requiredPermission: PermissionEnum = PermissionEnum.BILLING_VIEW_OWN
): AppMiddleware {
    return async (c, next) => {
        const actor = c.get('actor');

        // No actor means the upstream auth middleware did not run or rejected
        // the request. Pass through — defense in depth, not first line.
        if (!actor || !actor.id) {
            await next();
            return;
        }

        // Guest actors carry a sentinel id but no real session — let the
        // downstream `billingAuthMiddleware` reject them with 401 (which is
        // the correct status, not 403). Without this guard we would
        // pre-empt the 401 with a 403, breaking the contract that
        // unauthenticated requests return 401.
        if (isGuestActor(actor)) {
            await next();
            return;
        }

        if (!actor.permissions.includes(requiredPermission)) {
            apiLogger.warn(
                {
                    actorId: actor.id,
                    actorRole: actor.role,
                    requiredPermission,
                    path: c.req.path
                },
                'Billing self-perm check failed — actor lacks required permission'
            );
            throw new HTTPException(403, {
                message: `Permission denied: ${requiredPermission} required for self-billing access`
            });
        }

        await next();
    };
}

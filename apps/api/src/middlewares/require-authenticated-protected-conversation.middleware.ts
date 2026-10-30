/**
 * Router-level authentication gate for the protected conversation routes.
 *
 * These handlers are raw `createRouter()` routes, so they do not inherit the
 * 401 guard that `createProtectedRoute` provides. The guest actor carries a
 * real UUID and an empty permission set, which means an anonymous request would
 * otherwise reach the handler (and the service) as if it were a user
 * (HOS-1928, error-contract R2: 401 before 403/400/404).
 *
 * The gate is described with {@link describeRouteGate} so the static guard
 * `route-own-gate-declaration.guard.test.ts` can see it on the mounted app.
 *
 * @module middlewares/require-authenticated-protected-conversation
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { MiddlewareHandler } from 'hono';
import { getActorFromContext, isGuestActor } from '../utils/actor';
import { createErrorResponse } from '../utils/response-helpers';
import { describeRouteGate } from './route-gate-descriptor';

/**
 * Answers 401 `UNAUTHORIZED` to the guest actor and lets every other actor
 * through to the route's own ownership and permission checks.
 */
export const requireAuthenticatedProtectedConversation: MiddlewareHandler = describeRouteGate({
    handler: (async (c, next) => {
        if (isGuestActor(getActorFromContext(c))) {
            return createErrorResponse(
                { code: ServiceErrorCode.UNAUTHORIZED, message: 'Authentication required' },
                c,
                401
            );
        }
        await next();
    }) as MiddlewareHandler,
    descriptor: { level: 'protected', requiredPermissions: [], anyOfPermissions: [] }
});

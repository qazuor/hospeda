/**
 * Router-level authentication guard for the admin conversation routes.
 *
 * These handlers are raw `createRouter()` routes with inline permission checks,
 * so they do not inherit the 401 guard that `createAdminRoute` provides. The
 * guest actor carries a real UUID and an empty permission set, which means an
 * anonymous request would otherwise fall into each handler's 403 branch
 * (HOS-972, error-contract R2: 401 before 403).
 *
 * @module middlewares/require-authenticated-admin-conversation.middleware
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { MiddlewareHandler } from 'hono';
import { getActorFromContext, isGuestActor } from '../utils/actor';
import { createErrorResponse } from '../utils/response-helpers';

/**
 * Answers 401 `UNAUTHORIZED` to the guest actor and lets every other actor
 * through to the route's own permission checks.
 */
export const requireAuthenticatedAdminConversation: MiddlewareHandler = async (c, next) => {
    if (isGuestActor(getActorFromContext(c))) {
        return createErrorResponse(
            { code: ServiceErrorCode.UNAUTHORIZED, message: 'Authentication required' },
            c,
            401
        );
    }
    await next();
};

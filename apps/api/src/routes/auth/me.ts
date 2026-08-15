import { UserModel } from '@repo/db';
import { AuthMeResponseSchema, PermissionEnum } from '@repo/schemas';
import { HostTradeService } from '@repo/service-core';
import type { Context } from 'hono';
import { createGuestActor, isGuestActor } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * Builds the `/auth/me` payload from the actor the middleware resolved.
 *
 * Exported standalone so it is unit-testable against a mocked `Context`
 * without booting Hono, following the same precedent as the host-trade
 * protected routes.
 *
 * @param c - The request context carrying the resolved actor.
 * @returns The actor, its auth status, and the two derived account flags.
 */
export async function handleAuthMe(c: Context) {
    try {
        // Get actor from context (set by actor middleware)
        const actor = c.get('actor');

        // Check if user is authenticated by checking if actor is not a guest
        const isAuthenticated = !isGuestActor(actor);

        // Return all permissions for authenticated users.
        // Permissions are public knowledge to the user themselves and needed
        // for client-side feature gating (e.g. admin panel access checks).
        const filteredActor = actor;

        // Check passwordChangeRequired flag for admin panel users
        let passwordChangeRequired = false;
        const hasAdminAccess = actor.permissions.includes(PermissionEnum.ACCESS_PANEL_ADMIN);
        if (isAuthenticated && hasAdminAccess) {
            try {
                const userModel = new UserModel();
                const dbUser = await userModel.findById(actor.id);
                if (dbUser?.adminInfo?.passwordChangeRequired) {
                    passwordChangeRequired = true;
                }
            } catch {
                // Non-blocking: default false
            }
        }

        // Whether this account owns a directory listing (H-158).
        //
        // Resolved HERE and not in `actorMiddleware`, deliberately: that
        // middleware runs on EVERY authenticated API request, so a lookup
        // added there would be paid by the whole platform. `/auth/me` is
        // read once per protected page render by the web middleware, which
        // is exactly — and only — where the answer is needed. Same
        // placement, and same reasoning, as `passwordChangeRequired` above.
        //
        // Non-blocking: an account whose listing cannot be read is treated
        // as owning none. The consequence is a missing nav entry, never a
        // broken account page, and the entry reappears on the next render.
        let ownsHostTradeListing = false;
        if (isAuthenticated) {
            try {
                const own = await hostTradeService.getOwn(actor);
                ownsHostTradeListing = own.data?.trade != null;
            } catch {
                // Non-blocking: default false
            }
        }

        const result = {
            actor: filteredActor,
            isAuthenticated,
            passwordChangeRequired,
            ownsHostTradeListing
        };
        apiLogger.debug({ message: 'AuthMe: Returning result', result });
        return result;
    } catch (error) {
        apiLogger.error({ message: 'Error in /auth/me', error });
        // Degrade to a guest, and to the SAME shape as the happy path.
        // Returning a narrower object here made the handler's return type a
        // union, so every consumer had to narrow before reading a flag that is
        // always present in practice — and any consumer that skipped the
        // narrowing would read `undefined` where it expects a boolean.
        return {
            actor: createGuestActor(),
            isAuthenticated: false,
            passwordChangeRequired: false,
            ownsHostTradeListing: false
        };
    }
}

export const authMeRoute = createSimpleRoute({
    method: 'get',
    path: '/me',
    summary: 'Current authenticated actor',
    description: 'Returns current actor resolved by middleware and auth status.',
    tags: ['Auth'],
    options: { skipAuth: true }, // Skip auth middleware to check auth status
    responseSchema: AuthMeResponseSchema,
    handler: async (c) => handleAuthMe(c)
});

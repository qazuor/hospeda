/**
 * @route POST /api/v1/protected/profile/set-password
 *
 * Set-password endpoint for OAuth-only users (SPEC-113 T-113-03, §3.6).
 *
 * Authenticated users who signed up via Google or Facebook and have no
 * credential account row can use this endpoint to add a password so they
 * can also sign in via email/password going forward.
 *
 * Internally calls Better Auth's server-side `setPassword` API (which
 * creates the `credential` account row) and then flips
 * `set_password_prompted = true` on the user row.
 */

import type { z } from '@hono/zod-openapi';
import { ServiceErrorCode, SetPasswordBodySchema, SetPasswordResponseSchema } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getAuth } from '../../../lib/auth';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';
import { getDefaultUserService } from './_singletons';

/**
 * Minimal slice of UserService used by the set-password handler.
 * Allows unit tests to stub the service without standing up the full stack.
 */
export interface SetPasswordUserService {
    markSetPasswordDone: (
        actor: ReturnType<typeof getActorFromContext>,
        input: { userId: string }
    ) => Promise<{
        data?: { setPasswordPrompted: true; credentialCreated: true } | null;
        error?: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/** Better Auth `setPassword` adapter — injected for testing. */
export interface BetterAuthSetPassword {
    setPassword: (opts: {
        body: { newPassword: string };
        headers: Headers;
    }) => Promise<unknown>;
}

/** Dependency injection bag for the pure handler. */
export interface SetPasswordDeps {
    userService?: SetPasswordUserService;
    authApi?: BetterAuthSetPassword;
}

/** Body shape (post-Zod-parsed) consumed by the handler. */
export type SetPasswordBody = z.infer<typeof SetPasswordBodySchema>;

/**
 * Pure handler for the set-password route.
 *
 * @param ctx - Hono request context.
 * @param body - Validated request body containing `password`.
 * @param deps - Optional service dependency overrides (for testing).
 * @returns `{ setPasswordPrompted: true, credentialCreated: true }`.
 */
export const setPasswordHandler = async (
    ctx: Context,
    body: SetPasswordBody,
    deps: SetPasswordDeps = {}
): Promise<{ setPasswordPrompted: true; credentialCreated: true }> => {
    const actor = getActorFromContext(ctx);

    // TYPE-WORKAROUND: UserService satisfies the narrow SetPasswordUserService.
    const userSvc =
        deps.userService ?? (getDefaultUserService() as unknown as SetPasswordUserService);

    // 1. Invoke Better Auth's setPassword server-side — this creates the
    //    `credential` account row linked to the user.
    const authApi = deps.authApi ?? (getAuth().api as BetterAuthSetPassword);

    try {
        await authApi.setPassword({
            body: { newPassword: body.password },
            headers: ctx.req.raw.headers
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to set password';
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, message);
    }

    // 2. Flip set_password_prompted = true on the user row.
    const result = await userSvc.markSetPasswordDone(actor, { userId: actor.id });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }
    if (!result.data) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'markSetPasswordDone returned no data'
        );
    }

    return { setPasswordPrompted: true as const, credentialCreated: true as const };
};

export const profileSetPasswordRoute = createProtectedRoute({
    method: 'post',
    path: '/set-password',
    summary: 'Set a password for an OAuth-only account',
    description:
        'Allows users who signed up via Google or Facebook (and have no credential account) to add a password so they can also sign in via email/password. Calls Better Auth setPassword internally and flips set_password_prompted = true.',
    tags: ['Profile'],
    requestBody: SetPasswordBodySchema,
    responseSchema: SetPasswordResponseSchema,
    handler: async (ctx, _params, body) => setPasswordHandler(ctx, body as SetPasswordBody),
    options: {
        customRateLimit: { requests: 5, windowMs: 60000 }
    }
});

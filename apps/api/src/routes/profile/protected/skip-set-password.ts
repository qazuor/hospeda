/**
 * @route POST /api/v1/protected/profile/skip-set-password
 *
 * Skip-set-password endpoint (SPEC-113 T-113-03, §3.6).
 *
 * Authenticated OAuth-only users can skip the set-password prompt.
 * This flips `set_password_prompted = true` without creating any
 * credential account row.  The user is not re-prompted on subsequent
 * sign-ins.  They can still set a password later from their profile
 * security settings.
 */

import type { z } from '@hono/zod-openapi';
import {
    ServiceErrorCode,
    SkipSetPasswordBodySchema,
    SkipSetPasswordResponseSchema
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';
import { getDefaultUserService } from './_singletons';

/**
 * Minimal slice of UserService used by the skip-set-password handler.
 */
export interface SkipSetPasswordUserService {
    skipSetPassword: (
        actor: ReturnType<typeof getActorFromContext>,
        input: { userId: string }
    ) => Promise<{
        data?: { setPasswordPrompted: true; credentialCreated: false } | null;
        error?: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/** Dependency injection bag for the pure handler. */
export interface SkipSetPasswordDeps {
    userService?: SkipSetPasswordUserService;
}

/** Body shape (post-Zod-parsed) consumed by the handler. */
export type SkipSetPasswordBody = z.infer<typeof SkipSetPasswordBodySchema>;

/**
 * Pure handler for the skip-set-password route.
 *
 * @param ctx - Hono request context.
 * @param _body - Validated request body (empty).
 * @param deps - Optional service dependency overrides (for testing).
 * @returns `{ setPasswordPrompted: true, credentialCreated: false }`.
 */
export const skipSetPasswordHandler = async (
    ctx: Context,
    _body: SkipSetPasswordBody,
    deps: SkipSetPasswordDeps = {}
): Promise<{ setPasswordPrompted: true; credentialCreated: false }> => {
    const actor = getActorFromContext(ctx);

    // TYPE-WORKAROUND: UserService satisfies the narrow SkipSetPasswordUserService.
    const userSvc =
        deps.userService ?? (getDefaultUserService() as unknown as SkipSetPasswordUserService);

    const result = await userSvc.skipSetPassword(actor, { userId: actor.id });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }
    if (!result.data) {
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'skipSetPassword returned no data');
    }

    return { setPasswordPrompted: true as const, credentialCreated: false as const };
};

export const profileSkipSetPasswordRoute = createProtectedRoute({
    method: 'post',
    path: '/skip-set-password',
    summary: 'Skip the set-password prompt',
    description:
        'Allows OAuth-only users to dismiss the set-password prompt without setting a password. Flips set_password_prompted = true so the user is not re-prompted on subsequent sign-ins.',
    tags: ['Profile'],
    requestBody: SkipSetPasswordBodySchema,
    responseSchema: SkipSetPasswordResponseSchema,
    handler: async (ctx, _params, body) => skipSetPasswordHandler(ctx, body as SkipSetPasswordBody),
    options: {
        customRateLimit: { requests: 10, windowMs: 60000 }
    }
});

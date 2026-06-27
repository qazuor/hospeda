/**
 * @route POST /api/v1/protected/profile/push-token
 *
 * Push-token registration endpoint (SPEC-243 T-011).
 *
 * Authenticated users submit their Expo push token so the platform can send
 * targeted notifications.  The endpoint performs a global UPSERT on the token:
 * if another user previously registered this token (re-login on the same
 * device), ownership is silently transferred to the current actor.
 *
 * Self-scoped: the token is always registered for the authenticated actor.
 * No extra permissions beyond authentication are required.
 */

import {
    type PushTokenRegisterBody,
    PushTokenRegisterBodySchema,
    PushTokenRegisterResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';
import { getDefaultUserService } from './_singletons';

/**
 * Minimal slice of UserService used by the push-token handler.
 * Allows unit tests to stub the service without standing up the full stack.
 */
export interface PushTokenUserService {
    registerPushToken: (
        actor: ReturnType<typeof getActorFromContext>,
        input: { token: string; platform: string }
    ) => Promise<{
        data?: { registered: true } | null;
        error?: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/** Dependency injection bag for the pure handler. */
export interface PushTokenDeps {
    userService?: PushTokenUserService;
}

/** Body shape (post-Zod-parsed) consumed by the handler. */
export type PushTokenBody = PushTokenRegisterBody;

/**
 * Pure handler for the push-token registration route.
 *
 * Extracted so that tests can pass typed stubs without booting the full
 * service-core stack.  The route wiring below delegates directly to this.
 *
 * @param ctx - Hono request context (used for actor extraction).
 * @param body - Validated request body.
 * @param deps - Optional service dependency overrides (for testing).
 * @returns `{ registered: true }`.
 */
export const registerPushTokenHandler = async (
    ctx: Context,
    body: PushTokenBody,
    deps: PushTokenDeps = {}
): Promise<{ registered: true }> => {
    const actor = getActorFromContext(ctx);

    // TYPE-WORKAROUND: UserService structurally satisfies PushTokenUserService.
    const userSvc =
        deps.userService ?? (getDefaultUserService() as unknown as PushTokenUserService);

    const result = await userSvc.registerPushToken(actor, {
        token: body.token,
        platform: body.platform
    });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }
    if (!result.data) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'registerPushToken returned no data'
        );
    }

    return { registered: true as const };
};

export const profilePushTokenRoute = createProtectedRoute({
    method: 'post',
    path: '/push-token',
    summary: 'Register a push token',
    description:
        'Registers (or re-registers) an Expo push token for the authenticated user. Performs a global UPSERT — if the token was previously held by another user (re-login), ownership is transferred to the caller.',
    tags: ['Profile'],
    requestBody: PushTokenRegisterBodySchema,
    responseSchema: PushTokenRegisterResponseSchema,
    handler: async (ctx, _params, body) => registerPushTokenHandler(ctx, body as PushTokenBody),
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});

/**
 * Protected patch user endpoint
 * Allows users to partially update their own profile
 */
import {
    ServiceErrorCode,
    UserIdSchema,
    UserPatchInputSchema,
    UserProtectedSchema,
    UserSettingsWebPatchSchema
} from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createProtectedRoute } from '../../../utils/route-factory';
import { userCache } from '../../../utils/user-cache';

/**
 * Admin-only settings keys. If a protected (non-admin) user submits any of
 * these on a PATCH request, the request is rejected with 403 — the actor is
 * authenticated, so it is not a 401, but they lack the privilege to modify
 * admin-surface theme/language preferences (SPEC-096 / REQ-096-05 / T-032).
 */
const ADMIN_ONLY_SETTINGS_KEYS = ['themeAdmin', 'languageAdmin'] as const;

/**
 * Validate the `settings` field on a protected PATCH request against the
 * web-scoped allowlist. Rejects:
 *   - Admin-only keys (`themeAdmin`, `languageAdmin`)        → HTTP 403
 *   - Any other unknown key                                  → HTTP 400
 */
const validateProtectedSettings = (settings: unknown): void => {
    if (settings == null || typeof settings !== 'object') {
        return;
    }
    const submittedKeys = Object.keys(settings as Record<string, unknown>);

    // 403 takes precedence over 400 — surface admin-only rejection before
    // surfacing a "this key is unknown" message.
    const adminLeak = submittedKeys.find((k) =>
        (ADMIN_ONLY_SETTINGS_KEYS as readonly string[]).includes(k)
    );
    if (adminLeak !== undefined) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            `Field '${adminLeak}' is not writable on the protected (web) endpoint`
        );
    }

    const result = UserSettingsWebPatchSchema.safeParse(settings);
    if (!result.success) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid settings payload for the web (protected) endpoint',
            result.error.flatten()
        );
    }
};

const userService = new UserService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/users/:id
 * Partial update user - Protected endpoint
 * Users can only update their own profile
 */
export const protectedPatchUserRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update user',
    description:
        'Updates specific fields of user profile. Users can only update their own profile.',
    tags: ['Users'],
    requestParams: { id: UserIdSchema },
    requestBody: UserPatchInputSchema,
    responseSchema: UserProtectedSchema,
    // Ownership is enforced by UserService._canUpdate() which checks actor.id === entity.id
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        // Field-level permissions: protected (web) PATCH only accepts the
        // four web-scoped settings keys. Admin-only keys → 403, unknown
        // keys → 400 (SPEC-096 / REQ-096-05 / T-032).
        if (body && Object.prototype.hasOwnProperty.call(body, 'settings')) {
            validateProtectedSettings((body as { settings?: unknown }).settings);
        }

        // Transform API input (string dates) to domain format (Date objects)
        const domainInput = transformApiInputToDomain(body);

        const result = await userService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // Invalidate cache for the updated user
        if (result.data?.id) {
            userCache.invalidate(result.data.id);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});

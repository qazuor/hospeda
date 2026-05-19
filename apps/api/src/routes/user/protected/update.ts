/**
 * Protected update user endpoint
 * Allows users to update their own profile
 */
import {
    ServiceErrorCode,
    UserIdSchema,
    UserProtectedSchema,
    UserSettingsWebPatchSchema,
    type UserUpdateInput,
    UserUpdateInputSchema
} from '@repo/schemas';

/**
 * Body schema for the protected PUT route. Same shape as the general
 * UserUpdateInputSchema, but the `settings` field is constrained to the
 * web-scoped allowlist so Zod cannot inject admin defaults that would
 * later cause a spurious 403. See `patch.ts` for the full rationale.
 *
 * SPEC-096 / REQ-096-05 / T-032.
 */
const UserProtectedUpdateInputSchema = UserUpdateInputSchema.omit({
    settings: true
}).extend({
    settings: UserSettingsWebPatchSchema.optional()
});
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { userCache } from '../../../utils/user-cache';

/**
 * Admin-only settings keys. See `patch.ts` for full rationale —
 * SPEC-096 / REQ-096-05 / T-032.
 */
const ADMIN_ONLY_SETTINGS_KEYS = ['themeAdmin', 'languageAdmin'] as const;

const validateProtectedSettings = (settings: unknown): void => {
    if (settings == null || typeof settings !== 'object') {
        return;
    }
    const submittedKeys = Object.keys(settings as Record<string, unknown>);

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
 * PUT /api/v1/protected/users/:id
 * Update user - Protected endpoint
 * Users can only update their own profile
 */
export const protectedUpdateUserRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update user',
    description: 'Updates user information. Users can only update their own profile.',
    tags: ['Users'],
    requestParams: {
        id: UserIdSchema
    },
    requestBody: UserProtectedUpdateInputSchema,
    responseSchema: UserProtectedSchema,
    // Ownership is enforced by UserService._canUpdate() which checks actor.id === entity.id
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const userData = body as UserUpdateInput;

        // Field-level permissions: `UserProtectedUpdateInputSchema` constrains
        // `settings` to the web-scoped allowlist at the validator layer, so
        // Zod rejects admin keys with 400 before this handler runs. The
        // post-parse check below is kept as defence-in-depth only.
        // SPEC-096 / REQ-096-05 / T-032.
        if (body && Object.prototype.hasOwnProperty.call(body, 'settings')) {
            validateProtectedSettings((body as { settings?: unknown }).settings);
        }

        const result = await userService.update(actor, id as string, userData);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // Invalidate cache for the updated user
        if (result.data?.id) {
            userCache.invalidate(result.data.id);
        }

        return result.data;
    }
});

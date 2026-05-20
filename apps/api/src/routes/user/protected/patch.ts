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
 * Body schema for the protected PATCH route. Identical to the general
 * UserPatchInputSchema except that the `settings` field is constrained to
 * the web-scoped allowlist (no `themeAdmin` / `languageAdmin`, no defaults).
 *
 * Why this matters: the canonical `UserSettingsSchema` declares
 * `themeAdmin`/`languageAdmin` with `.default('system')`. When Hono's
 * validator middleware ran the request body through `UserPatchInputSchema`
 * (which embeds `UserSettingsSchema`), Zod silently injected those admin
 * defaults — and the route's admin-leak check then fired a spurious 403
 * for clients that never sent those keys. Using `UserSettingsWebPatchSchema`
 * here means Zod sees only the four web-allowed keys; strict mode rejects
 * admin keys at parse time (400) and never fills them as defaults.
 *
 * SPEC-096 / REQ-096-05 / T-032.
 */
const UserProtectedPatchInputSchema = UserPatchInputSchema.omit({
    settings: true
}).extend({
    settings: UserSettingsWebPatchSchema.optional()
});

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
    requestBody: UserProtectedPatchInputSchema,
    responseSchema: UserProtectedSchema,
    // Ownership is enforced by UserService._canUpdate() which checks actor.id === entity.id
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        // Field-level permissions: `UserProtectedPatchInputSchema` constrains
        // `settings` to the four web-scoped keys at the Zod-validator layer
        // (admin keys are rejected with 400 by strict-mode parsing). The
        // post-parse runtime check below is kept as a defence-in-depth
        // safety net — it currently cannot fire because Zod would have
        // rejected an admin key earlier, but it documents the contract for
        // future readers and guards against a schema regression.
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
        // 60/min is generous enough for human-driven flows on the settings page
        // (e.g. rapidly toggling several notification preferences in a row) while
        // still defending the endpoint against automated abuse. Bumped from 20
        // because 20/min was too tight when combined with reads on the same path
        // historically sharing the bucket (now fixed by method-scoped keys).
        customRateLimit: { requests: 60, windowMs: 60000 }
    }
});

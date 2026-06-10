/**
 * PATCH /api/v1/protected/users/me/tour-progress
 *
 * Records that the authenticated user has seen (or skipped) a specific admin
 * guided tour at the given config version. Delegates to
 * `UserService.markAdminTourSeen` which performs a server-side defensive
 * read-modify-write, preserving all sibling settings keys.
 *
 * Permission guard (SPEC-174 §6.2, D16):
 * `USER_SETTINGS_UPDATE` is the correct permission — it is held by HOST,
 * EDITOR, ADMIN, SUPER_ADMIN, and USER in
 * `packages/seed/src/required/rolePermissions.seed.ts`. This mirrors the
 * exact guard used by the whats-new-seen route (SPEC-175 T-007).
 *
 * The `settings` JSONB column is REPLACE-mode (`UserModel` inherits
 * `mergeableJsonbColumns = []`), so the service method MUST read-modify-write
 * to avoid clobbering sibling settings (see SPEC-174 D16 / D6).
 *
 * Idempotent: calling twice with the same `tourId` and `version` simply
 * overwrites the map entry with the same value.
 *
 * Rate limit: 30 req/min — lower than the general settings PATCH because
 * mark-seen is programmatic (not human-driven keystroke frequency).
 *
 * @see SPEC-174 §6.2, §6.3, D6, D16
 */
import { PermissionEnum, type ServiceErrorCode, TourProgressBodySchema } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/** Success response schema for the tour-progress endpoint. */
const TourProgressResponseSchema = z.object({
    success: z.literal(true)
});

/**
 * Minimal slice of UserService used by the handler. Exposed so the
 * regression test can pass a fully-typed stub without standing up the full
 * service-core stack.
 */
export interface TourProgressUserService {
    markAdminTourSeen: (
        actor: ReturnType<typeof getActorFromContext>,
        input: { tourId: string; version: number }
    ) => Promise<{
        data: { success: true } | null;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/**
 * Pure handler for the tour-progress PATCH route. Extracted for unit-testability.
 *
 * @param ctx - Hono context (used to resolve the authenticated actor).
 * @param body - Validated request body `{ tourId: string; version: number }`.
 * @param svc - UserService stub or instance.
 * @returns `{ success: true }` on success.
 */
export const tourProgressHandler = async (
    ctx: Context,
    body: { tourId: string; version: number },
    // TYPE-WORKAROUND: handler declares a narrow TourProgressUserService interface for
    // the testability seam; UserService structurally satisfies the narrow shape.
    svc: TourProgressUserService = userService as unknown as TourProgressUserService
): Promise<{ success: true }> => {
    const actor = getActorFromContext(ctx);

    const result = await svc.markAdminTourSeen(actor, {
        tourId: body.tourId,
        version: body.version
    });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { success: true };
};

/**
 * PATCH /api/v1/protected/users/me/tour-progress
 *
 * Records that the authenticated user has seen (or skipped) a specific admin
 * tour at the given config version. Requires `USER_SETTINGS_UPDATE` — held by
 * HOST, EDITOR, ADMIN, SUPER_ADMIN, and USER roles per
 * `packages/seed/src/required/rolePermissions.seed.ts`.
 *
 * @see SPEC-174 §6.2
 */
export const tourProgressRoute = createProtectedRoute({
    method: 'patch',
    path: '/me/tour-progress',
    summary: 'Mark an admin tour as seen',
    description:
        'Records that the authenticated user has seen (or skipped) a specific admin guided tour ' +
        'at the given config version. Performs a server-side read-modify-write merge — only ' +
        'settings.onboarding.adminTours[tourId] is overwritten; all other settings keys are preserved.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.USER_SETTINGS_UPDATE],
    requestBody: TourProgressBodySchema,
    responseSchema: TourProgressResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => tourProgressHandler(ctx, body as { tourId: string; version: number }),
    options: {
        customRateLimit: { requests: 30, windowMs: 60000 }
    }
});

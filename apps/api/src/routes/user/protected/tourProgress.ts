/**
 * GET /api/v1/protected/users/me/tour-progress
 * PATCH /api/v1/protected/users/me/tour-progress
 *
 * Tour progress endpoints for recording and retrieving tour seen-state.
 * Shared between the admin panel (SPEC-174) and the web app (SPEC-275).
 *
 * The `settings.onboarding.adminTours` JSONB map stores tourId -> version.
 * PATCH performs a server-side read-modify-write to avoid clobbering sibling settings.
 */
import { PermissionEnum, ServiceErrorCode, TourProgressBodySchema } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/** Minimal service interface for testability (SPEC-174 T-003). */
export interface TourProgressUserService {
    markAdminTourSeen: (
        actor: ReturnType<typeof getActorFromContext>,
        input: { tourId: string; version: number }
    ) => Promise<{
        data: { success: true } | null;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/** Response schema for GET / body for the tour-progress GET (tour seen map). */
const TourProgressMapSchema = z.object({
    tours: z.record(z.string(), z.number())
});

/** Success response schema for the tour-progress PATCH endpoint. */
const TourProgressResponseSchema = z.object({
    success: z.literal(true)
});

/**
 * Pure handler for the tour-progress GET route.
 */
export const tourProgressGetHandler = async (
    ctx: Context
): Promise<{ tours: Record<string, number> }> => {
    const actor = getActorFromContext(ctx);
    const result = await userService.getById(actor, actor.id);

    // ServiceOutput uses discriminated union: success = has data, error = has error
    if (result.error || !result.data) {
        const err = result.error ?? { code: ServiceErrorCode.NOT_FOUND, message: 'User not found' };
        throw new ServiceError(err.code, err.message);
    }
    const user = result.data;
    const tours = (user.settings?.onboarding?.adminTours ?? {}) as Record<string, number>;
    return { tours };
};

/**
 * Pure handler for the tour-progress PATCH route. Extracted for unit-testability.
 *
 * @param ctx - Hono context (used to resolve the authenticated actor).
 * @param body - Validated request body `{ tourId: string; version: number }`.
 * @param svc - Optional service stub for testing (defaults to real UserService).
 * @returns `{ success: true }` on success.
 */
export const tourProgressHandler = async (
    ctx: Context,
    body: { tourId: string; version: number },
    svc: TourProgressUserService = userService as unknown as TourProgressUserService // TYPE-WORKAROUND: UserService lacks tour methods; cast to narrow interface for DI/testability
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
 * GET /api/v1/protected/users/me/tour-progress
 *
 * Returns the authenticated user's admin tour progress map (tourId -> version).
 * No permission required beyond authentication (read own settings).
 */
export const tourProgressGetRoute = createProtectedRoute({
    method: 'get',
    path: '/me/tour-progress',
    summary: 'Get tour progress',
    description:
        "Returns the authenticated user's tour progress map (tourId -> version). " +
        'The map indicates which tours (admin and web) the user has seen and at which config version.',
    tags: ['Users'],
    responseSchema: TourProgressMapSchema,
    handler: tourProgressGetHandler,
    options: {
        customRateLimit: { requests: 60, windowMs: 60000 }
    }
});

/**
 * PATCH /api/v1/protected/users/me/tour-progress
 *
 * Records that the authenticated user has seen (or skipped) a specific guided
 * tour (admin or web) at the given config version. Requires `USER_SETTINGS_UPDATE` — held by
 * HOST, EDITOR, ADMIN, SUPER_ADMIN, and USER roles per
 * `packages/seed/src/required/rolePermissions.seed.ts`.
 *
 * @see SPEC-174 §6.2
 */
export const tourProgressRoute = createProtectedRoute({
    method: 'patch',
    path: '/me/tour-progress',
    summary: 'Mark a tour as seen',
    description:
        'Records that the authenticated user has seen (or skipped) a specific guided tour ' +
        '(admin or web) at the given config version. Performs a server-side read-modify-write merge — only ' +
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

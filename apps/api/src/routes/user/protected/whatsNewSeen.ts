/**
 * PATCH /api/v1/protected/users/me/whats-new-seen
 *
 * Marks one or more What's New entry ids as seen for the authenticated user.
 * Delegates to `UserService.markWhatsNewSeen` which performs a server-side
 * Set-union read-modify-write, preserving all sibling settings keys.
 *
 * Permission guard (SPEC-175 §6.6, Q1 resolution):
 * `USER_SETTINGS_UPDATE` is the correct permission — it is held by HOST (line 809),
 * EDITOR (line 704), ADMIN (line 479), SUPER_ADMIN (line 159), and USER (line 899)
 * in `packages/seed/src/required/rolePermissions.seed.ts`. This matches the
 * existing pattern used by the protected user `patch.ts` route for settings
 * operations. No new permission is needed.
 *
 * Idempotent: calling twice with overlapping ids is safe — the service uses
 * `Set` union, producing no duplicates (see SPEC-175 §10 edge cases).
 *
 * Rate limit: 30 req/min — lower than the general settings PATCH because
 * mark-seen is programmatic (not human-driven keystroke frequency).
 *
 * @see SPEC-175 §6.6, §10, §12.3
 */
import { PermissionEnum, type ServiceErrorCode, WhatsNewSeenBodySchema } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/** Success response schema for the mark-seen endpoint. */
const WhatsNewSeenResponseSchema = z.object({
    success: z.literal(true)
});

/**
 * Minimal slice of UserService used by the handler. Exposed so the
 * regression test can pass a fully-typed stub without standing up the full
 * service-core stack.
 */
export interface WhatsNewSeenUserService {
    markWhatsNewSeen: (
        actor: ReturnType<typeof getActorFromContext>,
        input: { ids: string[] }
    ) => Promise<{
        data: { success: true } | null;
        error: { code: ServiceErrorCode; message: string } | null;
    }>;
}

/**
 * Pure handler for the whats-new-seen PATCH route. Extracted for unit-testability.
 *
 * @param ctx - Hono context (used to resolve the authenticated actor).
 * @param body - Validated request body `{ ids: string[] }`.
 * @param svc - UserService stub or instance.
 * @returns `{ success: true }` on success.
 */
export const whatsNewSeenHandler = async (
    ctx: Context,
    body: { ids: string[] },
    // TYPE-WORKAROUND: handler declares a narrow WhatsNewSeenUserService interface for
    // the testability seam; UserService structurally satisfies the narrow shape.
    svc: WhatsNewSeenUserService = userService as unknown as WhatsNewSeenUserService
): Promise<{ success: true }> => {
    const actor = getActorFromContext(ctx);

    const result = await svc.markWhatsNewSeen(actor, { ids: body.ids });

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    return { success: true };
};

/**
 * PATCH /api/v1/protected/users/me/whats-new-seen
 *
 * Marks one or more What's New entry ids as seen for the authenticated user.
 * Requires `USER_SETTINGS_UPDATE` — held by HOST, EDITOR, ADMIN, SUPER_ADMIN,
 * and USER roles per `packages/seed/src/required/rolePermissions.seed.ts`.
 *
 * @see SPEC-175 §6.6
 */
export const whatsNewSeenRoute = createProtectedRoute({
    method: 'patch',
    path: '/me/whats-new-seen',
    summary: "Mark What's New entries as seen",
    description:
        "Marks one or more What's New entry ids as seen for the authenticated user. " +
        'Performs a server-side Set-union merge — calling twice with overlapping ids is idempotent.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.USER_SETTINGS_UPDATE],
    requestBody: WhatsNewSeenBodySchema,
    responseSchema: WhatsNewSeenResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => whatsNewSeenHandler(ctx, body as { ids: string[] }),
    options: {
        customRateLimit: { requests: 30, windowMs: 60000 }
    }
});

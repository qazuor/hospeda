/**
 * Toggle user bookmark route.
 * Creates a bookmark if it doesn't exist, or deletes it if it does (toggle behavior).
 * The userId is resolved from the authenticated session, not from the request body.
 * @route POST /api/v1/protected/user-bookmarks
 */
import {
    type UserBookmarkCreateInput,
    UserBookmarkCreateInputSchema,
    UserBookmarkSchema
} from '@repo/schemas';
import { ServiceError, UserBookmarkService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { assertFavoritesLimitOrThrow } from '../../../middlewares/limit-enforcement';
import { gateFavorites } from '../../../middlewares/tourist-entitlements';
import type { AppBindings } from '../../../types';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const bookmarkService = new UserBookmarkService({ logger: apiLogger });

/**
 * Request body schema for toggling a bookmark.
 * Omits userId because it is resolved server-side from the authenticated actor.
 */
const CreateBookmarkRequestSchema = UserBookmarkCreateInputSchema.omit({ userId: true });

/** Response schema for toggle operation */
const ToggleBookmarkResponseSchema = z.object({
    toggled: z.boolean(),
    bookmark: UserBookmarkSchema.nullable()
});

export const createUserBookmarkRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Toggle user bookmark',
    description:
        'Toggles a bookmark for the authenticated user. Creates if not exists, deletes if exists.',
    tags: ['User Bookmarks'],
    requestBody: CreateBookmarkRequestSchema,
    responseSchema: ToggleBookmarkResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = body as Omit<UserBookmarkCreateInput, 'userId'>;

        // Check if bookmark already exists for this user + entity + entityType
        const existingResult = await bookmarkService.findExistingBookmark(actor, {
            userId: actor.id,
            entityId: input.entityId,
            entityType: input.entityType
        });

        if (existingResult.data) {
            // Bookmark exists: delete it (toggle off)
            const deleteResult = await bookmarkService.softDelete(actor, existingResult.data.id);
            if (deleteResult.error) {
                throw new ServiceError(deleteResult.error.code, deleteResult.error.message);
            }
            return { toggled: false, bookmark: null };
        }

        // Bookmark does not exist: this is a toggle-ON (adding a new favorite).
        // Enforce the plan's MAX_FAVORITES limit HERE, not as a route middleware,
        // so that the toggle-OFF branch above is never blocked — a user at their
        // cap must still be able to remove favorites to free up space (BETA-42).
        await assertFavoritesLimitOrThrow({ context: ctx as Context<AppBindings>, actor });

        const result = await bookmarkService.create(actor, {
            ...input,
            userId: actor.id
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { toggled: true, bookmark: result.data };
    },
    options: {
        // gateFavorites — entitlement check (SAVE_FAVORITES). Tourist plans
        // (free/plus/vip) all include it; HOST / CLIENT_MANAGER do NOT. Throws
        // 403 ENTITLEMENT_REQUIRED if missing.
        //
        // The MAX_FAVORITES limit (free=3, plus=20, vip=-1 unlimited) is NOT
        // enforced as a middleware here: a toggle can either ADD or REMOVE a
        // favorite, and removing must never be blocked at the cap. The limit is
        // asserted inside the handler's toggle-ON branch only, via
        // assertFavoritesLimitOrThrow (BETA-42).
        middlewares: [gateFavorites()]
    }
});

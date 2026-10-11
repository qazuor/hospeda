/**
 * Toggle user bookmark route.
 * Creates a bookmark if it doesn't exist, or deletes it if it does (toggle behavior).
 * The userId is resolved from the authenticated session, not from the request body.
 * @route POST /api/v1/protected/user-bookmarks
 */
import {
    ServiceErrorCode,
    type UserBookmarkCreateInput,
    UserBookmarkCreateInputSchema,
    UserBookmarkSchema,
    VerticalEnum
} from '@repo/schemas';
import { ServiceError, UserBookmarkService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { enforceUserGate } from '../../../utils/listing-access/user-gate';
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

        await enforceUserGate({
            userId: actor.id,
            vertical: VerticalEnum.TOURIST,
            keys: ['save_favorites']
        });

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

        const countResult = await bookmarkService
            .countBookmarksForUser(actor, { userId: actor.id })
            .catch(() => {
                throw new ServiceError(
                    ServiceErrorCode.SERVICE_UNAVAILABLE,
                    'Usage count unavailable'
                );
            });
        if (countResult.error || !countResult.data) {
            throw new ServiceError(ServiceErrorCode.SERVICE_UNAVAILABLE, 'Usage count unavailable');
        }
        await enforceUserGate({
            userId: actor.id,
            vertical: VerticalEnum.TOURIST,
            limit: async () => ({ key: 'max_favorites', requested: countResult.data.count + 1 })
        });
        const result = await bookmarkService.create(actor, {
            ...input,
            userId: actor.id
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { toggled: true, bookmark: result.data };
    }
});

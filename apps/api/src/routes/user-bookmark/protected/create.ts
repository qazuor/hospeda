/**
 * Create user bookmark route.
 * Creates a new bookmark for the authenticated user.
 * @route POST /api/v1/protected/user-bookmarks
 */
import {
    type ServiceErrorCode,
    type UserBookmarkCreateInput,
    UserBookmarkCreateInputSchema,
    UserBookmarkSchema
} from '@repo/schemas';
import { ServiceError, UserBookmarkService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const bookmarkService = new UserBookmarkService({ logger: apiLogger });

export const createUserBookmarkRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create user bookmark',
    description: 'Creates a new bookmark for the authenticated user.',
    tags: ['User Bookmarks'],
    requestBody: UserBookmarkCreateInputSchema,
    responseSchema: UserBookmarkSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = body as UserBookmarkCreateInput;

        const result = await bookmarkService.create(actor, {
            ...input,
            userId: actor.id
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

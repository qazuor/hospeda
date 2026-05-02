/**
 * Create user bookmark collection route.
 * Creates a new named bookmark collection for the authenticated user.
 * The userId is resolved from the authenticated session, not from the request body.
 * @route POST /api/v1/protected/user-bookmark-collections
 */
import {
    ServiceErrorCode,
    type UserBookmarkCollectionCreateInput,
    UserBookmarkCollectionCreateInputSchema,
    UserBookmarkCollectionSchema
} from '@repo/schemas';
import { ServiceError, UserBookmarkCollectionService } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const collectionService = new UserBookmarkCollectionService({ logger: apiLogger });

/**
 * Request body schema for creating a bookmark collection.
 * Omits userId because it is resolved server-side from the authenticated actor.
 */
const CreateCollectionRequestSchema = UserBookmarkCollectionCreateInputSchema.omit({
    userId: true
});

export const createUserBookmarkCollectionRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create user bookmark collection',
    description:
        'Creates a new named bookmark collection for the authenticated user. The userId is derived from the session.',
    tags: ['User Bookmark Collections'],
    requestBody: CreateCollectionRequestSchema,
    responseSchema: UserBookmarkCollectionSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = body as Omit<UserBookmarkCollectionCreateInput, 'userId'>;

        const result = await collectionService.createCollection(actor, {
            ...input,
            userId: actor.id
        });

        if (result.error) {
            const { code, message } = result.error;

            // QUOTA_EXCEEDED maps to 403 Forbidden (per spec section "API Design")
            if (code === ServiceErrorCode.QUOTA_EXCEEDED) {
                throw new HTTPException(403, { message });
            }

            // ALREADY_EXISTS (NAME_TAKEN reason) maps to 409 Conflict
            if (code === ServiceErrorCode.ALREADY_EXISTS) {
                throw new HTTPException(409, { message });
            }

            throw new ServiceError(code, message, result.error.details);
        }

        return result.data;
    }
});

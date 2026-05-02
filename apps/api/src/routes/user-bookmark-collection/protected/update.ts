/**
 * Update user bookmark collection route.
 * Partially updates an existing collection owned by the authenticated user.
 * @route PATCH /api/v1/protected/user-bookmark-collections/:id
 */
import {
    ServiceErrorCode,
    UserBookmarkCollectionIdParamSchema,
    UserBookmarkCollectionSchema,
    type UserBookmarkCollectionUpdateInput,
    UserBookmarkCollectionUpdateInputSchema
} from '@repo/schemas';
import { ServiceError, UserBookmarkCollectionService } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const collectionService = new UserBookmarkCollectionService({ logger: apiLogger });

export const updateUserBookmarkCollectionRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Update user bookmark collection',
    description:
        'Partially updates a bookmark collection owned by the authenticated user. Supports updating name, description, color, and icon. Returns 404 if not found, 403 if not owner, 409 if the new name conflicts with an existing collection.',
    tags: ['User Bookmark Collections'],
    requestParams: UserBookmarkCollectionIdParamSchema.shape,
    requestBody: UserBookmarkCollectionUpdateInputSchema,
    responseSchema: UserBookmarkCollectionSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params as { id: string };
        const input = body as UserBookmarkCollectionUpdateInput;

        const result = await collectionService.updateCollection(actor, {
            collectionId: id,
            input
        });

        if (result.error) {
            const { code, message } = result.error;

            if (code === ServiceErrorCode.NOT_FOUND) {
                throw new HTTPException(404, { message });
            }

            if (code === ServiceErrorCode.FORBIDDEN) {
                throw new HTTPException(403, { message });
            }

            // ALREADY_EXISTS with reason NAME_TAKEN maps to 409 Conflict
            if (code === ServiceErrorCode.ALREADY_EXISTS) {
                throw new HTTPException(409, { message });
            }

            throw new ServiceError(code, message, result.error.details);
        }

        // result.data is guaranteed when result.error is absent
        // biome-ignore lint/style/noNonNullAssertion: result.data is guaranteed when result.error is absent
        return result.data!;
    }
});

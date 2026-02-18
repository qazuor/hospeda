/**
 * Check user bookmark status route.
 * Returns whether the authenticated user has bookmarked a specific entity.
 * @route GET /api/v1/protected/user-bookmarks/check
 */
import { EntityTypeEnum, type ServiceErrorCode } from '@repo/schemas';
import { ServiceError, UserBookmarkService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const bookmarkService = new UserBookmarkService({ logger: apiLogger });

/** Response schema for bookmark check */
const CheckBookmarkResponseSchema = z.object({
    isFavorited: z.boolean(),
    bookmarkId: z.string().nullable()
});

export const checkUserBookmarkRoute = createProtectedRoute({
    method: 'get',
    path: '/check',
    summary: 'Check bookmark status',
    description: 'Checks if the authenticated user has bookmarked a specific entity.',
    tags: ['User Bookmarks'],
    requestQuery: {
        entityId: z.string().uuid(),
        entityType: z.nativeEnum(EntityTypeEnum)
    },
    responseSchema: CheckBookmarkResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const entityId = (query?.entityId as string) || '';
        const entityType = (query?.entityType as string) || '';

        const result = await bookmarkService.findExistingBookmark(actor, {
            userId: actor.id,
            entityId,
            entityType
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            isFavorited: result.data !== null,
            bookmarkId: result.data?.id ?? null
        };
    }
});

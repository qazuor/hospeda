/**
 * List user bookmark collections route.
 * Returns paginated bookmark collections for the authenticated user, with a
 * usage block indicating the current count and the per-user limit.
 * @route GET /api/v1/protected/user-bookmark-collections
 */
import { UserBookmarkCollectionListItemSchema } from '@repo/schemas';
import {
    ServiceError,
    UserBookmarkCollectionService,
    getMaxCollectionsPerUser
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams } from '../../../utils/pagination';
import { createProtectedRoute } from '../../../utils/route-factory';

const collectionService = new UserBookmarkCollectionService({ logger: apiLogger });

/** Response schema for the list endpoint, including the usage block. */
const ListCollectionsResponseSchema = z.object({
    items: z.array(UserBookmarkCollectionListItemSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    usage: z.object({
        current: z.number().int().min(0),
        max: z.number().int().min(1)
    })
});

export const listUserBookmarkCollectionsRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'List user bookmark collections',
    description:
        'Returns paginated bookmark collections for the authenticated user. Includes a usage block with current count and per-user limit.',
    tags: ['User Bookmark Collections'],
    requestQuery: {
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(10),
        includeBookmarkCount: z
            .string()
            .optional()
            .transform((v) => v === 'true')
    },
    responseSchema: ListCollectionsResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const includeBookmarkCount = query?.includeBookmarkCount === true;

        const result = await collectionService.listCollectionsByUser(actor, {
            userId: actor.id,
            page,
            pageSize,
            includeBookmarkCount
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }

        // result.data is always defined when result.error is absent
        // biome-ignore lint/style/noNonNullAssertion: result.data is guaranteed when result.error is absent
        const { rows, total } = result.data!;

        const max = getMaxCollectionsPerUser();

        return {
            items: rows,
            total,
            page,
            pageSize,
            usage: {
                current: total,
                max
            }
        };
    }
});

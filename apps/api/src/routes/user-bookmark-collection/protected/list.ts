/**
 * List user bookmark collections route.
 * Returns paginated bookmark collections for the authenticated user, with a
 * usage block indicating the current count and the per-user limit.
 * @route GET /api/v1/protected/user-bookmark-collections
 */
import { LimitKey } from '@repo/billing';
import { UserBookmarkCollectionListItemSchema } from '@repo/schemas';
import { ServiceError, UserBookmarkCollectionService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getRemainingLimit } from '../../../middlewares/entitlement';
import { gateCollections } from '../../../middlewares/tourist-entitlements';
import type { AppBindings } from '../../../types';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams } from '../../../utils/pagination';
import { createProtectedRoute } from '../../../utils/route-factory';

const collectionService = new UserBookmarkCollectionService({ logger: apiLogger });

/**
 * Default plan limit when the limit is not yet configured in the entitlement
 * context (e.g. unrecognised plan). Mirrors the VIP plan limit (25).
 */
const DEFAULT_PLAN_LIMIT = 25;

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
    options: { middlewares: [gateCollections()] },
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

        // Resolve the plan limit from the entitlement context.
        // getRemainingLimit returns -1 for unlimited, 0 for disabled.
        // Both are mapped to a safe default: for unlimited (staff) we use
        // the hard cap (25); disabled should not reach here (gate blocks it).
        const rawLimit = getRemainingLimit(ctx as Context<AppBindings>, LimitKey.MAX_COLLECTIONS);
        const max = rawLimit === -1 ? 25 : rawLimit > 0 ? rawLimit : DEFAULT_PLAN_LIMIT;

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

/**
 * GET /api/v1/protected/search-history
 *
 * Returns the authenticated user's search history entries, newest first,
 * capped to the actor’s effective plan limit.
 *
 * @route GET /api/v1/protected/search-history
 * @module routes/search-history/protected/list
 */

import { UserSearchHistoryListItemSchema, VerticalEnum } from '@repo/schemas';
import { SearchHistoryService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { enforceUserGate, readEffectiveLimit } from '../../../utils/listing-access/user-gate';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const searchHistoryService = new SearchHistoryService({ logger: apiLogger });

/**
 * GET /api/v1/protected/search-history
 * List the actor's search history, newest first, capped to plan limit.
 */
export const listSearchHistoryRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'List search history',
    description:
        "Returns the authenticated user's accommodation search history entries, newest first, capped to the effective plan limit.",
    tags: ['Search History'],
    responseSchema: z.object({
        items: z.array(UserSearchHistoryListItemSchema),
        total: z.number()
    }),
    options: {
        customRateLimit: { requests: 120, windowMs: 60000 }
    },
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        await enforceUserGate({
            userId: actor.id,
            vertical: VerticalEnum.TOURIST,
            keys: ['can_view_search_history'],
            limit: async () => ({ key: 'max_search_history_entries', requested: 1 })
        });
        const planLimit = await readEffectiveLimit({
            userId: actor.id,
            vertical: VerticalEnum.TOURIST,
            key: 'max_search_history_entries'
        });

        const result = await searchHistoryService.list(actor, { planLimit });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            total: result.data?.total ?? 0
        };
    }
});

/**
 * GET /api/v1/protected/search-history
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

import { UserSearchHistoryListItemSchema } from '@repo/schemas';
import { SearchHistoryService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const searchHistoryService = new SearchHistoryService({ logger: apiLogger });

/**
 * Default plan limit when the limit is not yet configured in the entitlement
 * context (e.g. unrecognised plan). Mirrors the Plus plan limit (50).
 */
const DEFAULT_PLAN_LIMIT = 50;

/**
 * GET /api/v1/protected/search-history
 * List the actor's search history, newest first, capped to plan limit.
 */
export const listSearchHistoryRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'List search history',
    description:
        "Returns the authenticated user's accommodation search history entries, newest first, capped to the plan's MAX_SEARCH_HISTORY_ENTRIES limit (Plus = 50, VIP = 200).",
    tags: ['Search History'],
    responseSchema: z.object({
        items: z.array(UserSearchHistoryListItemSchema),
        total: z.number()
    }),
    options: {
        customRateLimit: { requests: 120, windowMs: 60000 }
    },
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed MAX_SEARCH_HISTORY_ENTRIES plan limit.
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        // The per-plan MAX_SEARCH_HISTORY_ENTRIES limit was removed with the
        // legacy billing system (HOS-1416); the hard cap (200) always applies.
        const planLimit = DEFAULT_PLAN_LIMIT;

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

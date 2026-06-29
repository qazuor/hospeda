/**
 * GET /api/v1/protected/search-history
 *
 * Returns the authenticated user's search history entries, newest first,
 * capped to the plan's `MAX_SEARCH_HISTORY_ENTRIES` limit.
 *
 * Entitlement gate: `CAN_VIEW_SEARCH_HISTORY` — handled by gateSearchHistory.
 * The actual capping is performed by `SearchHistoryService.list()`.
 *
 * @route GET /api/v1/protected/search-history
 * @module routes/search-history/protected/list
 */
import { LimitKey } from '@repo/billing';
import { UserSearchHistoryListItemSchema } from '@repo/schemas';
import { SearchHistoryService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getRemainingLimit } from '../../../middlewares/entitlement';
import { gateSearchHistory } from '../../../middlewares/tourist-entitlements';
import type { AppBindings } from '../../../types';
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
        entries: z.array(UserSearchHistoryListItemSchema),
        total: z.number()
    }),
    options: {
        middlewares: [gateSearchHistory()],
        customRateLimit: { requests: 120, windowMs: 60000 }
    },
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        // Resolve the plan limit from the entitlement context.
        // getRemainingLimit returns -1 for unlimited, 0 for disabled.
        // Both are mapped to a safe default: for unlimited (staff) we use
        // the hard cap (200); disabled should not reach here (gate blocks it).
        const rawLimit = getRemainingLimit(
            ctx as Context<AppBindings>,
            LimitKey.MAX_SEARCH_HISTORY_ENTRIES
        );
        const planLimit = rawLimit === -1 ? 200 : rawLimit > 0 ? rawLimit : DEFAULT_PLAN_LIMIT;

        const result = await searchHistoryService.list(actor, { planLimit });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            entries: result.data?.entries ?? [],
            total: result.data?.total ?? 0
        };
    }
});

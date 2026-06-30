/**
 * DELETE /api/v1/protected/search-history
 *
 * Hard-deletes ALL search history entries owned by the authenticated user.
 *
 * @route DELETE /api/v1/protected/search-history
 * @module routes/search-history/protected/clear-all
 */
import { SearchHistoryService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const searchHistoryService = new SearchHistoryService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/search-history
 * Clear all search history entries for the authenticated user.
 */
export const clearAllSearchHistoryRoute = createProtectedRoute({
    method: 'delete',
    path: '/',
    summary: 'Clear all search history',
    description: 'Permanently removes all search history entries for the authenticated user.',
    tags: ['Search History'],
    responseSchema: z.object({ deleted: z.number() }),
    options: {
        customRateLimit: { requests: 10, windowMs: 60000 }
    },
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const result = await searchHistoryService.clearAll(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

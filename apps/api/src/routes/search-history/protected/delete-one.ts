/**
 * DELETE /api/v1/protected/search-history/:id
 *
 * Hard-deletes a single search history entry owned by the authenticated user.
 * Returns 404 if the entry does not exist, 403 if it belongs to another user.
 *
 * @route DELETE /api/v1/protected/search-history/:id
 * @module routes/search-history/protected/delete-one
 */
import { SearchHistoryService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const searchHistoryService = new SearchHistoryService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/search-history/:id
 * Hard-delete one search history entry (owner-scoped).
 */
export const deleteOneSearchHistoryRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete one search history entry',
    description:
        'Permanently removes a single search history entry. The authenticated user must own the entry.',
    tags: ['Search History'],
    requestParams: { id: z.string().uuid() },
    responseSchema: z.object({ deleted: z.boolean() }),
    options: {
        customRateLimit: { requests: 60, windowMs: 60000 }
    },
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await searchHistoryService.deleteOne(actor, { id });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

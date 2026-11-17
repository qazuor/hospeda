/**
 * Public provider trade catalog endpoint (HOS-919).
 *
 * Returns the active groups with their active categories, already ordered, so
 * the anonymous alliance form, the public directory filter and the providers
 * presentation page can render the selector. Backed by
 * `HostTradeCategoryService.getPublicCatalog`, which needs no permission and
 * filters inactive and soft-deleted rows at both levels. The catalog is small
 * and changes as a whole, so it is returned as one nested document with no
 * pagination.
 */
import { PublicHostTradeCatalogSchema } from '@repo/schemas';
import { HostTradeCategoryService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const hostTradeCategoryService = new HostTradeCategoryService({ logger: apiLogger });

/**
 * GET /api/v1/public/host-trade-categories
 * List the public provider trade catalog - Public endpoint
 */
export const publicListHostTradeCategoriesRoute = createPublicRoute({
    method: 'get',
    path: '/',
    summary: 'List provider trade categories',
    description:
        'Returns the public provider trade catalog: active groups with their active categories, ordered by group weight, category weight and name.',
    tags: ['HostTradeCategories'],
    responseSchema: PublicHostTradeCatalogSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        const result = await hostTradeCategoryService.getPublicCatalog(actor);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data ?? { groups: [] };
    },
    options: {
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});

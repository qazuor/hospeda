/**
 * Public POI-category catalog list endpoint (HOS-147).
 *
 * Returns the full public POI category catalog (ACTIVE, non-deleted), ordered
 * by `displayWeight` descending then `slug` ascending, so the web thematic
 * filter-chip UI can render its chip options. Unlike the admin catalog list
 * (`admin/list.ts`, gated by `POI_CATEGORY_VIEW`), this is a public read backed
 * by `PointOfInterestCategoryService.listPublicCategories` (any actor). The
 * catalog is small (a closed set of ~a-few-dozen categories), so it is returned
 * as a bare array with no pagination, mirroring the sibling public destination
 * POI endpoint.
 */
import { PoiCategoryPublicSchema } from '@repo/schemas';
import { PointOfInterestCategoryService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const pointOfInterestCategoryService = new PointOfInterestCategoryService({ logger: apiLogger });

/**
 * GET /api/v1/public/poi-categories
 * List the public POI category catalog - Public endpoint (HOS-147)
 */
export const publicListPoiCategoriesRoute = createPublicRoute({
    method: 'get',
    path: '/',
    summary: 'List POI categories',
    description:
        'Returns the full public POI category catalog (ACTIVE only), ordered by displayWeight then slug, for the thematic filter-chip UI.',
    tags: ['POI Categories'],
    responseSchema: z.array(PoiCategoryPublicSchema),
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        const result = await pointOfInterestCategoryService.listPublicCategories(actor);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data?.categories ?? [];
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});

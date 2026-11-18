/**
 * Public partner type catalog endpoint (HOS-2336).
 *
 * Returns the ACTIVE, non-deleted types ordered by `displayWeight`, then
 * Spanish name, then slug, with every locale's name so each client labels them
 * in its own locale. Backed by `PartnerTypeService.getPublicList`, which needs
 * no permission. The catalog is tiny, so there is no pagination.
 */
import { PublicPartnerTypeListSchema } from '@repo/schemas';
import { PartnerTypeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const partnerTypeService = new PartnerTypeService({ logger: apiLogger });

/**
 * GET /api/v1/public/partner-types
 * List the active partner types - Public endpoint
 */
export const publicListPartnerTypesRoute = createPublicRoute({
    method: 'get',
    path: '/',
    summary: 'List partner types',
    description:
        'Returns the active partner types ordered by display weight, then Spanish name, with their localized names.',
    tags: ['PartnerTypes'],
    responseSchema: PublicPartnerTypeListSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        const result = await partnerTypeService.getPublicList(actor);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data ?? { items: [] };
    },
    options: {
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});

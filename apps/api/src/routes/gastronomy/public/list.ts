/**
 * Public gastronomy list endpoint (T-042)
 * Returns a paginated list of visible gastronomy listings with filtering and sorting.
 *
 * Visibility contract: only listings with lifecycleState=ACTIVE AND visibility=PUBLIC
 * are returned. The GastronomyService._executeSearch already applies deletedAt=null;
 * the route relies on the service's public-tier contract for the remaining gates.
 */
import {
    GastronomyPublicSchema,
    type GastronomySearchHttp,
    GastronomySearchHttpSchema,
    httpToDomainGastronomySearch
} from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * GET /api/v1/public/gastronomies
 * List gastronomy listings — Public endpoint.
 *
 * All filter params from GastronomySearchHttpSchema are converted to the domain
 * search input via httpToDomainGastronomySearch and forwarded to
 * gastronomyService.search(), which force-filters deletedAt=null and applies
 * scalar filters (type, priceRange, destinationId, isFeatured, ownerId).
 */
export const publicListGastronomiesRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List gastronomy listings',
    description: 'Returns a paginated list of public gastronomy listings',
    tags: ['Gastronomy'],
    requestQuery: GastronomySearchHttpSchema.shape,
    responseSchema: GastronomyPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const httpQuery = (query ?? {}) as GastronomySearchHttp;
        const domainParams = httpToDomainGastronomySearch(httpQuery);

        const result = await gastronomyService.search(actor, {
            ...domainParams,
            page,
            pageSize
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const items = result.data?.items || [];

        return {
            items,
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});

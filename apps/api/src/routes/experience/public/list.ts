/**
 * Public experience list endpoint (T-019)
 * Returns a paginated list of experience listings with filtering and sorting.
 *
 * Visibility note: the service _executeSearch only filters deletedAt=null (non-deleted
 * listings). It does NOT apply lifecycleState=ACTIVE or visibility=PUBLIC at the search
 * layer — that is inherited SPEC-239 behaviour and tracked as a follow-up. Per-item
 * visibility gating is applied on the detail endpoint via _canView. The web client is
 * responsible for filtering displayed results by visibility state.
 */
import {
    ExperiencePublicSchema,
    type ExperienceSearchHttp,
    ExperienceSearchHttpSchema,
    httpToDomainExperienceSearch
} from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * GET /api/v1/public/experiences
 * List experience listings — Public endpoint.
 *
 * All filter params from ExperienceSearchHttpSchema are converted to the domain
 * search input via httpToDomainExperienceSearch and forwarded to
 * experienceService.search(), which force-filters deletedAt=null and applies
 * scalar filters (type, destinationId, isFeatured, ownerId, minRating, maxRating).
 */
export const publicListExperiencesRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List experience listings',
    description: 'Returns a paginated list of public experience listings',
    tags: ['Experience'],
    requestQuery: ExperienceSearchHttpSchema.shape,
    responseSchema: ExperiencePublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const httpQuery = (query ?? {}) as ExperienceSearchHttp;
        const domainParams = httpToDomainExperienceSearch(httpQuery);

        const result = await experienceService.search(actor, {
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

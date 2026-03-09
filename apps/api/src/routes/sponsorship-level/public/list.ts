/**
 * Public sponsorship level list endpoint
 * Returns paginated list of public sponsorship levels
 */
import { SponsorshipLevelSchema, SponsorshipLevelSearchSchema } from '@repo/schemas';
import { ServiceError, SponsorshipLevelService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const sponsorshipLevelService = new SponsorshipLevelService({ logger: apiLogger });

/**
 * GET /api/v1/public/sponsorship-levels
 * List sponsorship levels - Public endpoint
 */
export const sponsorshipLevelListRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List sponsorship levels',
    description: 'Returns a paginated list of sponsorship levels',
    tags: ['Sponsorship Levels'],
    requestQuery: SponsorshipLevelSearchSchema.omit({ page: true, limit: true }).shape,
    responseSchema: SponsorshipLevelSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await sponsorshipLevelService.list(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});

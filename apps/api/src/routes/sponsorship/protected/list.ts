/**
 * Protected sponsorship list endpoint
 * Returns paginated list of sponsorships (authenticated users only)
 */
import { SponsorshipProtectedSchema, SponsorshipSearchSchema } from '@repo/schemas';
import { ServiceError, SponsorshipService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createProtectedListRoute } from '../../../utils/route-factory';

const sponsorshipService = new SponsorshipService({ logger: apiLogger });

/**
 * GET /api/v1/protected/sponsorships
 * List sponsorships - Protected endpoint
 */
export const protectedSponsorshipListRoute = createProtectedListRoute({
    method: 'get',
    path: '/',
    summary: 'List sponsorships',
    description: 'Returns a paginated list of sponsorships. Requires authentication.',
    tags: ['Sponsorships'],
    requestQuery: SponsorshipSearchSchema.omit({ page: true, limit: true }).shape,
    responseSchema: SponsorshipProtectedSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await sponsorshipService.list(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});

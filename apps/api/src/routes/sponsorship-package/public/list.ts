/**
 * Public sponsorship package list endpoint
 * Returns paginated list of public sponsorship packages
 */
import {
    SponsorshipPackageSchema,
    type SponsorshipPackageSearchInput,
    SponsorshipPackageSearchSchema
} from '@repo/schemas';
import { ServiceError, SponsorshipPackageService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const sponsorshipPackageService = new SponsorshipPackageService({ logger: apiLogger });

/**
 * GET /api/v1/public/sponsorship-packages
 * List sponsorship packages - Public endpoint
 */
export const sponsorshipPackageListRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List sponsorship packages',
    description: 'Returns a paginated list of sponsorship packages',
    tags: ['Sponsorship Packages'],
    requestQuery: SponsorshipPackageSearchSchema.omit({ page: true, limit: true }).shape,
    responseSchema: SponsorshipPackageSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await sponsorshipPackageService.search(actor, {
            ...(query as SponsorshipPackageSearchInput),
            page,
            limit: pageSize
        });

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

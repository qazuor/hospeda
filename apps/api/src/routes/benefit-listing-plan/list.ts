import { BenefitListingPlanSchema, BenefitListingPlanSearchSchema } from '@repo/schemas';
import { BenefitListingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const benefitListingPlanListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List benefit listing plans',
    description: 'Returns a paginated list of benefit listing plans',
    tags: ['Benefit Listing Plans'],
    requestQuery: BenefitListingPlanSearchSchema.shape,
    responseSchema: BenefitListingPlanSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const service = new BenefitListingPlanService({ logger: apiLogger });
        const result = await service.list(actor, query || {});
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});

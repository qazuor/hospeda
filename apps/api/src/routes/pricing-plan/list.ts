import {
    type HttpPricingPlanSearch,
    HttpPricingPlanSearchSchema,
    PricingPlanSchema,
    httpToDomainPricingPlanSearch
} from '@repo/schemas';
import { PricingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const pricingPlanListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List pricing plans',
    description: 'Returns a paginated list of pricing plans with filtering options',
    tags: ['Pricing Plans'],
    requestQuery: HttpPricingPlanSearchSchema.shape,
    responseSchema: PricingPlanSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);

        // Convert HTTP query params to domain search input
        const searchInput = httpToDomainPricingPlanSearch({
            ...(query as HttpPricingPlanSearch),
            page,
            pageSize
        });

        const service = new PricingPlanService({ logger: apiLogger });
        const result = await service.list(actor, searchInput);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});

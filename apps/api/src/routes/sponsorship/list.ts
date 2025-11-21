import { SearchSponsorshipsSchema, SponsorshipSchema } from '@repo/schemas';
import { SponsorshipService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const sponsorshipListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List sponsorships',
    description: 'Returns a paginated list of sponsorships',
    tags: ['Sponsorships'],
    requestQuery: SearchSponsorshipsSchema.shape,
    responseSchema: SponsorshipSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const service = new SponsorshipService({ logger: apiLogger });
        const result = await service.list(actor, query || {});
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});

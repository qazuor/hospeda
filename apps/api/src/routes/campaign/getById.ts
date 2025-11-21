import { z } from '@hono/zod-openapi';
import { CampaignSchema } from '@repo/schemas';
import { CampaignService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const campaignGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get campaign by ID',
    description: 'Returns a single campaign by ID',
    tags: ['Campaigns'],
    requestParams: { id: z.string().uuid() },
    responseSchema: CampaignSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new CampaignService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

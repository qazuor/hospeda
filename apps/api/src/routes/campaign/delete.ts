import { z } from '@hono/zod-openapi';
import { CampaignSchema } from '@repo/schemas';
import { CampaignService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const campaignDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete campaign',
    description: 'Soft deletes a campaign',
    tags: ['Campaigns'],
    requestParams: { id: z.string().uuid() },
    responseSchema: CampaignSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new CampaignService({ logger: apiLogger });
        const result = await service.softDelete(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

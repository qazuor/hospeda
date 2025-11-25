import { z } from '@hono/zod-openapi';
import { CampaignModel } from '@repo/db';
import {
    CampaignSchema,
    HttpUpdateCampaignSchema,
    httpToDomainCampaignUpdate
} from '@repo/schemas';
import { CampaignService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import type { z as zodType } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const campaignUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update campaign',
    description: 'Updates an existing advertising campaign',
    tags: ['Campaigns'],
    requestParams: { id: z.string().uuid() },
    requestBody: HttpUpdateCampaignSchema,
    responseSchema: CampaignSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new CampaignService({ logger: apiLogger }, new CampaignModel());
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as zodType.infer<typeof HttpUpdateCampaignSchema>;

        // Convert HTTP data to domain format
        const domainData = httpToDomainCampaignUpdate(validatedBody);

        const result = await service.update(actor, params.id as string, domainData);

        if (result.error) {
            // Re-throw ServiceError to preserve error code and details
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }

        if (!result.data) {
            throw new ServiceError('NOT_FOUND', 'Campaign not found');
        }

        return result.data;
    }
});

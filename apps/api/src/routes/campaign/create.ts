import { CampaignModel } from '@repo/db';
import {
    CampaignSchema,
    HttpCreateCampaignSchema,
    httpToDomainCampaignCreate
} from '@repo/schemas';
import { CampaignService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const campaignCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create campaign',
    description: 'Creates a new advertising campaign',
    tags: ['Campaigns'],
    requestBody: HttpCreateCampaignSchema,
    responseSchema: CampaignSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new CampaignService({ logger: apiLogger }, new CampaignModel());
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof HttpCreateCampaignSchema>;

        // Convert HTTP data to domain format
        const domainData = httpToDomainCampaignCreate(validatedBody);

        const result = await service.create(actor, domainData);

        if (result.error) {
            // Re-throw ServiceError to preserve error code and details
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }

        if (!result.data) {
            throw new ServiceError('INTERNAL_ERROR', 'Campaign creation failed');
        }

        return result.data;
    }
});

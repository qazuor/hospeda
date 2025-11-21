import {
    BenefitListingPlanCreateHttpSchema,
    BenefitListingPlanSchema,
    httpToDomainBenefitListingPlanCreate
} from '@repo/schemas';
import { BenefitListingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const benefitListingPlanCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create benefit listing plan',
    description: 'Creates a new benefit listing plan',
    tags: ['Benefit Listing Plans'],
    requestBody: BenefitListingPlanCreateHttpSchema,
    responseSchema: BenefitListingPlanSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new BenefitListingPlanService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof BenefitListingPlanCreateHttpSchema>;

        // Convert HTTP data to domain format
        const domainData = httpToDomainBenefitListingPlanCreate(validatedBody);

        const result = await service.create(actor, domainData);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

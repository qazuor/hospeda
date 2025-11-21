import { z } from '@hono/zod-openapi';
import {
    BenefitListingPlanSchema,
    BenefitListingPlanUpdateHttpSchema,
    httpToDomainBenefitListingPlanUpdate
} from '@repo/schemas';
import { BenefitListingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z as zodType } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const benefitListingPlanUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update benefit listing plan',
    description: 'Updates an existing benefit listing plan',
    tags: ['Benefit Listing Plans'],
    requestParams: { id: z.string().uuid() },
    requestBody: BenefitListingPlanUpdateHttpSchema,
    responseSchema: BenefitListingPlanSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new BenefitListingPlanService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as zodType.infer<typeof BenefitListingPlanUpdateHttpSchema>;

        // Convert HTTP data to domain format
        const domainData = httpToDomainBenefitListingPlanUpdate(validatedBody);

        const result = await service.update(actor, params.id as string, domainData);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

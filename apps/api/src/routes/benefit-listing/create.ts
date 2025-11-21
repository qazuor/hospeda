import { BenefitListingSchema, CreateBenefitListingSchema } from '@repo/schemas';
import { BenefitListingService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const benefitListingCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create benefit listing',
    description: 'Creates a new benefit listing',
    tags: ['Benefit Listings'],
    requestBody: CreateBenefitListingSchema,
    responseSchema: BenefitListingSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new BenefitListingService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof CreateBenefitListingSchema>;

        const result = await service.create(actor, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

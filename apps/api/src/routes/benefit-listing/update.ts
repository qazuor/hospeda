import { z } from '@hono/zod-openapi';
import { BenefitListingSchema, UpdateBenefitListingSchema } from '@repo/schemas';
import { BenefitListingService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const benefitListingUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update benefit listing',
    description: 'Updates an existing benefit listing',
    tags: ['Benefit Listings'],
    requestParams: { id: z.string().uuid() },
    requestBody: UpdateBenefitListingSchema,
    responseSchema: BenefitListingSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new BenefitListingService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof UpdateBenefitListingSchema>;

        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

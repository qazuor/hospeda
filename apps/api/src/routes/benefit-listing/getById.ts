import { z } from '@hono/zod-openapi';
import { BenefitListingSchema } from '@repo/schemas';
import { BenefitListingService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const benefitListingGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get benefit listing by ID',
    description: 'Returns a single benefit listing by ID',
    tags: ['Benefit Listings'],
    requestParams: { id: z.string().uuid() },
    responseSchema: BenefitListingSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new BenefitListingService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

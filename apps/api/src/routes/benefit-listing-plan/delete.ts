import { z } from '@hono/zod-openapi';
import { BenefitListingPlanSchema } from '@repo/schemas';
import { BenefitListingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const benefitListingPlanDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete benefit listing plan',
    description: 'Soft deletes a benefit listing plan',
    tags: ['Benefit Listing Plans'],
    requestParams: { id: z.string().uuid() },
    responseSchema: BenefitListingPlanSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new BenefitListingPlanService({ logger: apiLogger });
        const result = await service.softDelete(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

import { PricingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const pricingPlanDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '//:id',
    summary: 'Delete pricing plan',
    description: 'Soft deletes a pricing plan (sets deletedAt timestamp)',
    tags: ['Pricing Plans'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new PricingPlanService({ logger: apiLogger });
        const result = await service.softDelete(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            success: true,
            message: 'Pricing plan deleted successfully'
        };
    }
});

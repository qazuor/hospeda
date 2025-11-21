import { z } from '@hono/zod-openapi';
import { BenefitPartnerSchema } from '@repo/schemas';
import { BenefitPartnerService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const benefitPartnerDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete benefit partner',
    description: 'Soft deletes a benefit partner',
    tags: ['Benefit Partners'],
    requestParams: { id: z.string().uuid() },
    responseSchema: BenefitPartnerSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new BenefitPartnerService({ logger: apiLogger });
        const result = await service.softDelete(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

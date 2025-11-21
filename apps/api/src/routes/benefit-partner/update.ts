import { z } from '@hono/zod-openapi';
import {
    BenefitPartnerSchema,
    BenefitPartnerUpdateHttpSchema,
    httpToDomainBenefitPartnerUpdate
} from '@repo/schemas';
import { BenefitPartnerService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z as zodType } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const benefitPartnerUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update benefit partner',
    description: 'Updates an existing benefit partner',
    tags: ['Benefit Partners'],
    requestParams: { id: z.string().uuid() },
    requestBody: BenefitPartnerUpdateHttpSchema,
    responseSchema: BenefitPartnerSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new BenefitPartnerService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as zodType.infer<typeof BenefitPartnerUpdateHttpSchema>;

        // Convert HTTP data to domain format
        const domainData = httpToDomainBenefitPartnerUpdate(validatedBody);

        const result = await service.update(actor, params.id as string, domainData);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

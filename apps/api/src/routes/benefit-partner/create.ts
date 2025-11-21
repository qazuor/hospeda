import {
    BenefitPartnerCreateHttpSchema,
    BenefitPartnerSchema,
    httpToDomainBenefitPartnerCreate
} from '@repo/schemas';
import { BenefitPartnerService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const benefitPartnerCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create benefit partner',
    description: 'Creates a new benefit partner',
    tags: ['Benefit Partners'],
    requestBody: BenefitPartnerCreateHttpSchema,
    responseSchema: BenefitPartnerSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new BenefitPartnerService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof BenefitPartnerCreateHttpSchema>;

        // Convert HTTP data to domain format
        const domainData = httpToDomainBenefitPartnerCreate(validatedBody);

        const result = await service.create(actor, domainData);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

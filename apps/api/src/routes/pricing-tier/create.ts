import { PricingTierCreateHttpSchema, PricingTierSchema } from '@repo/schemas';
import { PricingTierService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createErrorResponse } from '../../utils/response-helpers';
import { createCRUDRoute } from '../../utils/route-factory';

export const pricingTierCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create pricing tier',
    description: 'Creates a new pricing tier entity',
    tags: ['Pricing Tiers'],
    requestBody: PricingTierCreateHttpSchema,
    responseSchema: PricingTierSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);

        // Manual validation to ensure refinements are checked
        const parseResult = PricingTierCreateHttpSchema.safeParse(body);
        if (!parseResult.success) {
            return createErrorResponse(
                {
                    code: 'VALIDATION_ERROR',
                    message: parseResult.error.issues.map((e) => e.message).join(', ')
                },
                ctx,
                400
            );
        }

        // Convert HTTP data (bigint) to service input (number)
        const httpData = parseResult.data;
        const createInput = {
            ...httpData,
            unitPriceMinor: Number(httpData.unitPriceMinor)
        };

        const service = new PricingTierService({ logger: apiLogger });
        const result = await service.create(actor, createInput);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});

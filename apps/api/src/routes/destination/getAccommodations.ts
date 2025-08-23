import { DestinationIdSchema } from '@repo/schemas';
import { DestinationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

export const getDestinationAccommodationsRoute = createCRUDRoute({
    method: 'get',
    path: '/{id}/accommodations',
    summary: 'Get accommodations by destination',
    description: 'Returns all accommodations belonging to a destination',
    tags: ['Destinations'],
    requestParams: {
        id: DestinationIdSchema
    },
    // We return an array of raw accommodations (service returns typed array). Keep response as any[] to avoid big schema here.
    // TODO [ea1cc49c-e231-4577-9e5a-ea0a60c0a7ad]: Add a dedicated response schema if needed.
    responseSchema: DestinationIdSchema as unknown as import('@hono/zod-openapi').z.ZodTypeAny, // placeholder; route-factory requires a schema
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await destinationService.getAccommodations(actor, { destinationId: id });
        if (result.error) throw new Error(result.error.message);
        return result.data;
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 60,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});

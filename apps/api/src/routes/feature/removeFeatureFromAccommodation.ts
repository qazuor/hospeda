import { z } from '@hono/zod-openapi';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const removeFeatureFromAccommodationRoute = createCRUDRoute({
    method: 'delete',
    path: '/accommodations/{accommodationId}/features/{featureId}',
    summary: 'Remove feature from accommodation',
    description: 'Removes a relation between a feature and an accommodation',
    tags: ['Features', 'Accommodations'],
    requestParams: { accommodationId: z.string().uuid(), featureId: z.string().uuid() },
    responseSchema: z.object({ relation: z.object({ featureId: z.string().uuid() }).partial() }),
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const payload = {
            accommodationId: params.accommodationId as string,
            featureId: params.featureId as string
        };
        const service = new FeatureService({ logger: apiLogger });
        const result = await service.removeFeatureFromAccommodation(actor, payload);
        if (result.error) throw new Error(result.error.message);
        return { relation: result.data.relation };
    }
});

import { z } from '@hono/zod-openapi';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const addFeatureToAccommodationRoute = createCRUDRoute({
    method: 'post',
    path: '/accommodations/{accommodationId}/features',
    summary: 'Add feature to accommodation',
    description: 'Creates a relation between a feature and an accommodation',
    tags: ['Features', 'Accommodations'],
    requestParams: { accommodationId: z.string().uuid() },
    requestBody: z.object({
        featureId: z.string().uuid(),
        hostReWriteName: z.string().optional(),
        comments: z.string().optional()
    }),
    responseSchema: z.object({ relation: z.object({ featureId: z.string().uuid() }).partial() }),
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const parsed = body as { featureId: string; hostReWriteName?: string; comments?: string };
        const payload = {
            accommodationId: params.accommodationId as string,
            featureId: parsed.featureId,
            hostReWriteName: parsed.hostReWriteName,
            comments: parsed.comments
        };
        const service = new FeatureService({ logger: apiLogger });
        const result = await service.addFeatureToAccommodation(actor, payload);
        if (result.error) throw new Error(result.error.message);
        return { relation: result.data.relation };
    }
});

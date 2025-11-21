import { z } from '@hono/zod-openapi';
import { FeaturedAccommodationSchema } from '@repo/schemas';
import { FeaturedAccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const featuredAccommodationGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get featured accommodation by ID',
    description: 'Returns a single featured accommodation by ID',
    tags: ['Featured Accommodations'],
    requestParams: { id: z.string().uuid() },
    responseSchema: FeaturedAccommodationSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new FeaturedAccommodationService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

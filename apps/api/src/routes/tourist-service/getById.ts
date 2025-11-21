import { z } from '@hono/zod-openapi';
import { TouristServiceSchema } from '@repo/schemas';
import { TouristServiceService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const touristServiceGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get tourist service by ID',
    description: 'Returns a single tourist service by ID',
    tags: ['Tourist Services'],
    requestParams: { id: z.string().uuid() },
    responseSchema: TouristServiceSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new TouristServiceService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

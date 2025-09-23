import { z } from '@hono/zod-openapi';
import { DestinationSchema } from '@repo/schemas';
import { DestinationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

export const getDestinationBySlugRoute = createCRUDRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get destination by slug',
    description: 'Retrieves a destination by its slug',
    tags: ['Destinations'],
    requestParams: {
        slug: z.string().min(1)
    },
    responseSchema: DestinationSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const slug = params.slug as string;
        const result = await destinationService.getBySlug(actor, slug);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});

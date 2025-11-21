import { z } from '@hono/zod-openapi';
import { FeaturedAccommodationSchema, FeaturedAccommodationUpdateInputSchema } from '@repo/schemas';
import { FeaturedAccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z as zodType } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const featuredAccommodationUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update featured accommodation',
    description: 'Updates an existing featured accommodation',
    tags: ['Featured Accommodations'],
    requestParams: { id: z.string().uuid() },
    requestBody: FeaturedAccommodationUpdateInputSchema,
    responseSchema: FeaturedAccommodationSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new FeaturedAccommodationService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as zodType.infer<typeof FeaturedAccommodationUpdateInputSchema>;
        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

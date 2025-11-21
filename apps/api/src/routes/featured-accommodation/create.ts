import { FeaturedAccommodationCreateInputSchema, FeaturedAccommodationSchema } from '@repo/schemas';
import { FeaturedAccommodationService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const featuredAccommodationCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create featured accommodation',
    description: 'Creates a new featured accommodation',
    tags: ['Featured Accommodations'],
    requestBody: FeaturedAccommodationCreateInputSchema,
    responseSchema: FeaturedAccommodationSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new FeaturedAccommodationService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof FeaturedAccommodationCreateInputSchema>;

        const result = await service.create(actor, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

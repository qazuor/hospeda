import { z } from '@hono/zod-openapi';
import { SponsorshipSchema, UpdateSponsorshipSchema } from '@repo/schemas';
import { SponsorshipService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const sponsorshipUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update sponsorship',
    description: 'Updates an existing sponsorship',
    tags: ['Sponsorships'],
    requestParams: { id: z.string().uuid() },
    requestBody: UpdateSponsorshipSchema,
    responseSchema: SponsorshipSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new SponsorshipService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof UpdateSponsorshipSchema>;

        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

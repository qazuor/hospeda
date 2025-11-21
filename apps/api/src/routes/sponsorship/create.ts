import { CreateSponsorshipSchema, SponsorshipSchema } from '@repo/schemas';
import { SponsorshipService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const sponsorshipCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create sponsorship',
    description: 'Creates a new sponsorship',
    tags: ['Sponsorships'],
    requestBody: CreateSponsorshipSchema,
    responseSchema: SponsorshipSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new SponsorshipService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof CreateSponsorshipSchema>;

        const result = await service.create(actor, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

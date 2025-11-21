import { z } from '@hono/zod-openapi';
import { SponsorshipSchema } from '@repo/schemas';
import { SponsorshipService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const sponsorshipGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get sponsorship by ID',
    description: 'Returns a single sponsorship by ID',
    tags: ['Sponsorships'],
    requestParams: { id: z.string().uuid() },
    responseSchema: SponsorshipSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new SponsorshipService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

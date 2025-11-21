import { z } from '@hono/zod-openapi';
import { SponsorshipSchema } from '@repo/schemas';
import { SponsorshipService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const sponsorshipDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete sponsorship',
    description: 'Soft deletes a sponsorship',
    tags: ['Sponsorships'],
    requestParams: { id: z.string().uuid() },
    responseSchema: SponsorshipSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new SponsorshipService({ logger: apiLogger });
        const result = await service.softDelete(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

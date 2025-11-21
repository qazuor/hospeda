import { z } from '@hono/zod-openapi';
import { ProfessionalServiceSchema } from '@repo/schemas';
import { ProfessionalServiceService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const professionalServiceDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete professional service',
    description: 'Soft deletes a professional service',
    tags: ['Professional Services'],
    requestParams: { id: z.string().uuid() },
    responseSchema: ProfessionalServiceSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new ProfessionalServiceService({ logger: apiLogger });
        const result = await service.softDelete(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

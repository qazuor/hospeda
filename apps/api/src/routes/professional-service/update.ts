import { z } from '@hono/zod-openapi';
import { HttpUpdateProfessionalServiceSchema, ProfessionalServiceSchema } from '@repo/schemas';
import { ProfessionalServiceService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const professionalServiceUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update professional service',
    description: 'Updates an existing professional service',
    tags: ['Professional Services'],
    requestParams: { id: z.string().uuid() },
    requestBody: HttpUpdateProfessionalServiceSchema,
    responseSchema: ProfessionalServiceSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new ProfessionalServiceService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof HttpUpdateProfessionalServiceSchema>;
        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

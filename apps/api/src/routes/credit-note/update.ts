import { z } from '@hono/zod-openapi';
import { CreditNoteSchema, UpdateCreditNoteHTTPSchema } from '@repo/schemas';
import { CreditNoteService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const creditNoteUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update credit note',
    description: 'Updates an existing credit note',
    tags: ['Credit Notes'],
    requestParams: { id: z.string().uuid() },
    requestBody: UpdateCreditNoteHTTPSchema,
    responseSchema: CreditNoteSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new CreditNoteService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof UpdateCreditNoteHTTPSchema>;
        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

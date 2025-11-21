import { CreateCreditNoteHTTPSchema, CreditNoteSchema } from '@repo/schemas';
import { CreditNoteService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const creditNoteCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create credit note',
    description: 'Creates a new credit note',
    tags: ['Credit Notes'],
    requestBody: CreateCreditNoteHTTPSchema,
    responseSchema: CreditNoteSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new CreditNoteService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof CreateCreditNoteHTTPSchema>;

        const result = await service.create(actor, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

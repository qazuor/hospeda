import { z } from '@hono/zod-openapi';
import { CreditNoteSchema } from '@repo/schemas';
import { CreditNoteService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const creditNoteDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete credit note',
    description: 'Soft deletes a credit note',
    tags: ['Credit Notes'],
    requestParams: { id: z.string().uuid() },
    responseSchema: CreditNoteSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new CreditNoteService({ logger: apiLogger });
        const result = await service.softDelete(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});

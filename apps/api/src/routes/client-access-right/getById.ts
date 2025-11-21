import { ClientAccessRightSchema } from '@repo/schemas';
import { ClientAccessRightService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const clientAccessRightGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '//:id',
    summary: 'Get client access right by ID',
    description: 'Retrieves a single client access right by their unique identifier',
    tags: ['Client Access Rights'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: ClientAccessRightSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new ClientAccessRightService({ logger: apiLogger });
        const result = await service.getById(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Client access right not found');
        }

        return result.data;
    }
});

import { ClientAccessRightService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const clientAccessRightDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '//:id',
    summary: 'Delete client access right',
    description: 'Soft deletes a client access right (sets deletedAt timestamp)',
    tags: ['Client Access Rights'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new ClientAccessRightService({ logger: apiLogger });
        const result = await service.softDelete(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            success: true,
            message: 'Client access right deleted successfully'
        };
    }
});

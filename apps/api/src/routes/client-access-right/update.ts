import {
    ClientAccessRightSchema,
    type ClientAccessRightUpdateHttp,
    ClientAccessRightUpdateHttpSchema,
    httpToDomainClientAccessRightUpdate
} from '@repo/schemas';
import { ClientAccessRightService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const clientAccessRightUpdateRoute = createCRUDRoute({
    method: 'patch',
    path: '//:id',
    summary: 'Update client access right',
    description: 'Updates an existing client access right with partial data',
    tags: ['Client Access Rights'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: ClientAccessRightUpdateHttpSchema,
    responseSchema: ClientAccessRightSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        // Convert HTTP data to domain input
        const updateInput = httpToDomainClientAccessRightUpdate(
            body as ClientAccessRightUpdateHttp
        );

        const service = new ClientAccessRightService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const _validatedBody = body as z.infer<typeof ClientAccessRightUpdateHttpSchema>;
        const result = await service.update(actor, id as string, updateInput);

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Client access right not found');
        }

        return result.data;
    }
});

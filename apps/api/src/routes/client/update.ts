import {
    ClientSchema,
    type ClientUpdateHttp,
    ClientUpdateHttpSchema,
    httpToDomainClientUpdate
} from '@repo/schemas';
import { ClientService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const clientUpdateRoute = createCRUDRoute({
    method: 'patch',
    path: '//:id',
    summary: 'Update client',
    description: 'Updates an existing client with partial data',
    tags: ['Clients'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: ClientUpdateHttpSchema,
    responseSchema: ClientSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        // Convert HTTP data to domain input
        const updateInput = httpToDomainClientUpdate(body as ClientUpdateHttp);

        const service = new ClientService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const _validatedBody = body as z.infer<typeof ClientUpdateHttpSchema>;
        const result = await service.update(actor, id as string, updateInput);

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Client not found');
        }

        return result.data;
    }
});

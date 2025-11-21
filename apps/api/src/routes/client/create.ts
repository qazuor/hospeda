import {
    type ClientCreateHttp,
    ClientCreateHttpSchema,
    ClientSchema,
    httpToDomainClientCreate
} from '@repo/schemas';
import { ClientService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const clientCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create client',
    description: 'Creates a new client entity',
    tags: ['Clients'],
    requestBody: ClientCreateHttpSchema,
    responseSchema: ClientSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);

        // Convert HTTP data to domain input
        const createInput = httpToDomainClientCreate(body as ClientCreateHttp);

        const service = new ClientService({ logger: apiLogger });
        const result = await service.create(actor, createInput);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});

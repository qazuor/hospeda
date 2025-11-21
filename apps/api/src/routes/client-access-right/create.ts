import {
    type ClientAccessRightCreateHttp,
    ClientAccessRightCreateHttpSchema,
    ClientAccessRightSchema,
    httpToDomainClientAccessRightCreate
} from '@repo/schemas';
import { ClientAccessRightService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const clientAccessRightCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create client access right',
    description: 'Creates a new client access right entity',
    tags: ['Client Access Rights'],
    requestBody: ClientAccessRightCreateHttpSchema,
    responseSchema: ClientAccessRightSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);

        // Convert HTTP data to domain input
        const createInput = httpToDomainClientAccessRightCreate(
            body as ClientAccessRightCreateHttp
        );

        const service = new ClientAccessRightService({ logger: apiLogger });
        const result = await service.create(actor, createInput);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});

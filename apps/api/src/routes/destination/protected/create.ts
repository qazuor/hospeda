/**
 * Protected create destination endpoint
 * Requires authentication
 */
import {
    type DestinationCreateHttp,
    DestinationCreateHttpSchema,
    DestinationProtectedSchema,
    PermissionEnum,
    type ServiceErrorCode,
    httpToDomainDestinationCreate
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * POST /api/v1/protected/destinations
 * Create destination - Protected endpoint
 */
export const protectedCreateDestinationRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    summary: 'Create destination',
    description: 'Creates a new destination. Requires DESTINATION_CREATE permission.',
    tags: ['Destinations'],
    requiredPermissions: [PermissionEnum.DESTINATION_CREATE],
    requestBody: DestinationCreateHttpSchema,
    responseSchema: DestinationProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // Convert HTTP input to domain input
        const domainInput = httpToDomainDestinationCreate(body as DestinationCreateHttp);
        const result = await destinationService.create(actor, domainInput);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

/**
 * Protected update destination endpoint
 * Requires authentication and ownership or admin permission
 */
import {
    DestinationIdSchema,
    DestinationProtectedSchema,
    DestinationUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * PUT /api/v1/protected/destinations/:id
 * Update destination - Protected endpoint
 */
export const protectedUpdateDestinationRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update destination',
    description: 'Updates a destination by ID. Requires DESTINATION_UPDATE permission.',
    tags: ['Destinations'],
    requiredPermissions: [PermissionEnum.DESTINATION_UPDATE],
    requestParams: { id: DestinationIdSchema },
    requestBody: DestinationUpdateInputSchema,
    responseSchema: DestinationProtectedSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await destinationService.update(actor, id, body as never);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    }
});

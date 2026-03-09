/**
 * Protected soft delete destination endpoint
 * Requires authentication and ownership or admin permission
 */
import { DestinationIdSchema, PermissionEnum } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/destinations/:id
 * Soft delete destination - Protected endpoint
 */
export const protectedSoftDeleteDestinationRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete destination',
    description: 'Soft deletes a destination by ID. Requires DESTINATION_DELETE permission.',
    tags: ['Destinations'],
    requiredPermissions: [PermissionEnum.DESTINATION_DELETE],
    requestParams: { id: DestinationIdSchema },
    responseSchema: DestinationIdSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await destinationService.softDelete(actor, id);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return { id };
    }
});

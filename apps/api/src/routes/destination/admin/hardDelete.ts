/**
 * Admin hard delete destination endpoint
 * Permanently deletes a destination - Admin only
 */
import { DestinationIdSchema, PermissionEnum } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/destinations/:id/hard
 * Hard delete destination - Admin endpoint
 */
export const adminHardDeleteDestinationRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete destination',
    description: 'Permanently deletes a destination by ID. Admin only.',
    tags: ['Destinations'],
    requiredPermissions: [PermissionEnum.DESTINATION_DELETE],
    requestParams: { id: DestinationIdSchema },
    responseSchema: DestinationIdSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await destinationService.hardDelete(actor, id);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return { id };
    }
});

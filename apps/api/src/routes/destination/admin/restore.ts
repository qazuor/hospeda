/**
 * Admin restore destination endpoint
 * Restores a soft-deleted destination - Admin only
 */
import { DestinationIdSchema } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/destinations/:id/restore
 * Restore destination - Admin endpoint
 */
export const adminRestoreDestinationRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore destination',
    description: 'Restores a soft-deleted destination. Admin only.',
    tags: ['Destinations'],
    requestParams: { id: DestinationIdSchema },
    responseSchema: DestinationIdSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const result = await destinationService.restore(actor, id);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return { id };
    }
});

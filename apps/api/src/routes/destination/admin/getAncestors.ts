/**
 * Admin endpoint for getting all ancestors of a destination
 * Returns the ancestor chain from root to parent including drafts and deleted
 */
import { DestinationAdminSchema, DestinationIdSchema, PermissionEnum } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/destinations/:id/ancestors
 * Get all ancestors of a destination - Admin endpoint
 */
export const adminGetDestinationAncestorsRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/ancestors',
    summary: 'Get destination ancestors (admin)',
    description:
        'Retrieves all ancestor destinations from root to the parent of the given destination, including drafts and deleted. Admin only.',
    tags: ['Destinations', 'Hierarchy'],
    requiredPermissions: [PermissionEnum.DESTINATION_VIEW_ALL],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: z.object({
        ancestors: z.array(DestinationAdminSchema)
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getAncestors(actor, {
            destinationId: params.id as string
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 60, // Shorter than public (60s vs 600s) since admin needs fresher data
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});

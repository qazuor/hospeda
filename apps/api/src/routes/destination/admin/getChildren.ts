/**
 * Admin endpoint for getting direct children of a destination
 * Returns all immediate child destinations including drafts and deleted
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
 * GET /api/v1/admin/destinations/:id/children
 * Get direct children of a destination - Admin endpoint
 */
export const adminGetDestinationChildrenRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/children',
    summary: 'Get destination children (admin)',
    description:
        'Retrieves all direct child destinations including drafts and deleted. Admin only.',
    tags: ['Destinations', 'Hierarchy'],
    requiredPermissions: [PermissionEnum.DESTINATION_VIEW_ALL],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: z.object({
        children: z.array(DestinationAdminSchema)
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getChildren(actor, {
            destinationId: params.id as string
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});

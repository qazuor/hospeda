/**
 * Admin endpoint for getting all descendants of a destination
 * Returns all descendants including drafts and deleted, with optional depth and type filtering
 */
import {
    DestinationAdminSchema,
    DestinationIdSchema,
    type DestinationTypeEnum,
    DestinationTypeEnumSchema,
    PermissionEnum
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/destinations/:id/descendants
 * Get all descendants of a destination - Admin endpoint
 */
export const adminGetDestinationDescendantsRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/descendants',
    summary: 'Get destination descendants (admin)',
    description:
        'Retrieves all descendants of a given destination including drafts and deleted, with optional depth and type filters. Admin only.',
    tags: ['Destinations', 'Hierarchy'],
    requiredPermissions: [PermissionEnum.DESTINATION_VIEW_ALL],
    requestParams: {
        id: DestinationIdSchema
    },
    requestQuery: {
        maxDepth: z.coerce.number().int().min(1).max(10).optional(),
        destinationType: DestinationTypeEnumSchema.optional()
    },
    responseSchema: z.object({
        descendants: z.array(DestinationAdminSchema)
    }),
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        _body: unknown,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getDescendants(actor, {
            destinationId: params.id as string,
            maxDepth: query?.maxDepth as number | undefined,
            destinationType: query?.destinationType as DestinationTypeEnum | undefined
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});

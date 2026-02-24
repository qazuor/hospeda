/**
 * Admin soft delete attraction endpoint
 * Soft deletes an attraction
 */
import {
    AttractionIdSchema,
    DeleteResultSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/attractions/:id
 * Soft delete attraction - Admin endpoint
 */
export const adminDeleteAttractionRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete attraction (admin)',
    description: 'Soft deletes an attraction. Admin only.',
    tags: ['Attractions'],
    requiredPermissions: [PermissionEnum.ATTRACTION_DELETE],
    requestParams: {
        id: AttractionIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await attractionService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});

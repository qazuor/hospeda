/**
 * Admin restore attraction endpoint
 * Restores a soft-deleted attraction
 */
import { AttractionAdminSchema, AttractionIdSchema, PermissionEnum } from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * POST /api/v1/admin/attractions/:id/restore
 * Restore attraction - Admin endpoint
 */
export const adminRestoreAttractionRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore attraction',
    description: 'Restores a soft-deleted attraction. Requires ATTRACTION_RESTORE permission.',
    tags: ['Attractions'],
    requiredPermissions: [PermissionEnum.ATTRACTION_RESTORE],
    requestParams: {
        id: AttractionIdSchema
    },
    responseSchema: AttractionAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const restoreResult = await attractionService.restore(actor, id);

        if (restoreResult.error) {
            throw new ServiceError(restoreResult.error.code, restoreResult.error.message);
        }

        const fetchResult = await attractionService.getById(actor, id);

        if (fetchResult.error) {
            throw new ServiceError(fetchResult.error.code, fetchResult.error.message);
        }

        return fetchResult.data;
    }
});

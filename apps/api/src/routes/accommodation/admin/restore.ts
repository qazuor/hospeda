/**
 * Admin restore accommodation endpoint
 * Restores a soft-deleted accommodation
 */
import { AccommodationAdminSchema, AccommodationIdSchema, PermissionEnum } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/accommodations/:id/restore
 * Restore accommodation - Admin endpoint
 */
export const adminRestoreAccommodationRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore accommodation',
    description:
        'Restores a soft-deleted accommodation. Requires ACCOMMODATION_RESTORE permission.',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_RESTORE_ANY],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.restore(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

/**
 * Admin restore accommodation endpoint
 * Restores a soft-deleted accommodation
 */
import { AccommodationAdminSchema, AccommodationIdSchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/accommodations/:id/restore
 * Restore accommodation - Admin endpoint
 *
 * Permission model (SPEC-143 Finding #14 extension): service layer
 * (`checkCanRestore`) enforces `ACCOMMODATION_RESTORE_ANY` OR
 * (`ACCOMMODATION_RESTORE_OWN` + ownership). Route only requires
 * admin-panel access.
 */
export const adminRestoreAccommodationRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore accommodation',
    description:
        'Restores a soft-deleted accommodation. Requires admin-panel access; the service layer enforces RESTORE_ANY or (RESTORE_OWN + ownership).',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const restoreResult = await accommodationService.restore(actor, id);

        if (restoreResult.error) {
            throw new ServiceError(restoreResult.error.code, restoreResult.error.message);
        }

        const fetchResult = await accommodationService.adminGetById(actor, id);

        if (fetchResult.error) {
            throw new ServiceError(fetchResult.error.code, fetchResult.error.message);
        }

        return fetchResult.data;
    }
});

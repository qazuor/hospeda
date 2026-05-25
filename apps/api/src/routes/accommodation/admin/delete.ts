/**
 * Admin delete (soft) accommodation endpoint
 * Allows admins to soft delete any accommodation
 */
import { AccommodationIdSchema, DeleteResultSchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/accommodations/:id
 * Soft delete accommodation - Admin endpoint
 *
 * Permission model (SPEC-143 Finding #14 extension): entity-specific
 * permission is enforced at the service layer (`checkCanSoftDelete`)
 * which accepts `ACCOMMODATION_DELETE_ANY` OR (`ACCOMMODATION_DELETE_OWN`
 * + ownership). Route only requires admin-panel access so HOSTs editing
 * their own accommodations from the admin UI can delete them.
 */
export const adminDeleteAccommodationRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete accommodation (admin)',
    description:
        'Soft deletes an accommodation. Requires admin-panel access; the service layer enforces DELETE_ANY or (DELETE_OWN + ownership).',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await accommodationService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});

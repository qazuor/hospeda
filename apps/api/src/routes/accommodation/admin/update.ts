/**
 * Admin update accommodation endpoint
 * Allows admins to update any accommodation
 */
import {
    AccommodationAdminSchema,
    AccommodationIdSchema,
    type AccommodationUpdateInput,
    AccommodationUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/accommodations/:id
 * Update accommodation - Admin endpoint
 */
export const adminUpdateAccommodationRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update accommodation (admin)',
    description: 'Updates any accommodation. Admin only.',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationUpdateInputSchema,
    responseSchema: AccommodationAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as AccommodationUpdateInput;

        const result = await accommodationService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

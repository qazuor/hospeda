/**
 * Admin update destination endpoint
 * Allows admins to update any destination
 */
import {
    DestinationAdminSchema,
    DestinationIdSchema,
    type DestinationUpdateInput,
    DestinationUpdateInputSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/destinations/:id
 * Update destination - Admin endpoint
 */
export const adminUpdateDestinationRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update destination (admin)',
    description: 'Updates any destination. Admin only.',
    tags: ['Destinations'],
    requiredPermissions: [PermissionEnum.DESTINATION_UPDATE],
    requestParams: {
        id: DestinationIdSchema
    },
    requestBody: DestinationUpdateInputSchema,
    responseSchema: DestinationAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as DestinationUpdateInput;

        const result = await destinationService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

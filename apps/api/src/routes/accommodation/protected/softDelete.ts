/**
 * Protected soft delete accommodation endpoint
 * Requires authentication and ownership
 */
import { AccommodationIdSchema, PermissionEnum, type ServiceErrorCode } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * DELETE /api/v1/protected/accommodations/:id
 * Soft delete accommodation - Protected endpoint with ownership check
 */
export const protectedSoftDeleteAccommodationRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete accommodation',
    description:
        'Soft deletes an accommodation. Requires ownership or ACCOMMODATION_DELETE_ANY permission.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    ownership: {
        entityType: 'accommodation',
        ownershipFields: ['ownerId', 'createdById'],
        bypassPermission: PermissionEnum.ACCOMMODATION_DELETE_ANY
    },
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.softDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            success: true,
            message: 'Accommodation soft deleted successfully'
        };
    }
});

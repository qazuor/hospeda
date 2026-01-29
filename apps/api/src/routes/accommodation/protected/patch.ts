/**
 * Protected patch accommodation endpoint
 * Requires authentication and ownership
 */
import {
    AccommodationIdSchema,
    AccommodationProtectedSchema,
    AccommodationUpdateHttpSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/accommodations/:id
 * Partial update accommodation - Protected endpoint with ownership check
 */
export const protectedPatchAccommodationRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Patch accommodation',
    description:
        'Partially updates an accommodation. Requires ownership or ACCOMMODATION_UPDATE_ANY permission.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationUpdateHttpSchema.partial(),
    responseSchema: AccommodationProtectedSchema,
    ownership: {
        entityType: 'accommodation',
        ownershipFields: ['ownerId', 'createdById'],
        bypassPermission: PermissionEnum.ACCOMMODATION_UPDATE_ANY
    },
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // Use update method for patch - service handles partial updates
        const result = await accommodationService.update(actor, params.id as string, body);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

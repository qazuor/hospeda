/**
 * Admin patch accommodation endpoint
 * Allows admins to partially update any accommodation
 */
import {
    AccommodationAdminSchema,
    AccommodationIdSchema,
    AccommodationPatchInputSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/accommodations/:id
 * Partial update accommodation - Admin endpoint
 */
export const adminPatchAccommodationRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update accommodation (admin)',
    description: 'Updates specific fields of any accommodation. Admin only.',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
    requestParams: { id: AccommodationIdSchema },
    requestBody: AccommodationPatchInputSchema,
    responseSchema: AccommodationAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);

        const result = await accommodationService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});

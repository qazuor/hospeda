/**
 * Admin create accommodation endpoint
 * Allows admins to create new accommodations
 */
import {
    AccommodationAdminSchema,
    type AccommodationCreateInput,
    AccommodationCreateInputSchema,
    PermissionEnum,
    type ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/accommodations
 * Create accommodation - Admin endpoint
 */
export const adminCreateAccommodationRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create accommodation',
    description: 'Creates a new accommodation. Admin only.',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_CREATE],
    requestBody: AccommodationCreateInputSchema,
    responseSchema: AccommodationAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as AccommodationCreateInput;

        const result = await accommodationService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

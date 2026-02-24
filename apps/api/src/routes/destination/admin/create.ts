/**
 * Admin create destination endpoint
 * Allows admins to create new destinations
 */
import {
    DestinationAdminSchema,
    type DestinationCreateInput,
    DestinationCreateInputSchema,
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
 * POST /api/v1/admin/destinations
 * Create destination - Admin endpoint
 */
export const adminCreateDestinationRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create destination',
    description: 'Creates a new destination. Admin only.',
    tags: ['Destinations'],
    requiredPermissions: [PermissionEnum.DESTINATION_CREATE],
    requestBody: DestinationCreateInputSchema,
    responseSchema: DestinationAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as DestinationCreateInput;

        const result = await destinationService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});

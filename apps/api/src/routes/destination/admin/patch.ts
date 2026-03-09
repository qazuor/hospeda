/**
 * Admin patch destination endpoint
 * Allows admins to partially update any destination
 */
import {
    DestinationAdminSchema,
    DestinationIdSchema,
    DestinationPatchInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/destinations/:id
 * Partial update destination - Admin endpoint
 */
export const adminPatchDestinationRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update destination (admin)',
    description: 'Updates specific fields of any destination. Admin only.',
    tags: ['Destinations'],
    requiredPermissions: [PermissionEnum.DESTINATION_UPDATE],
    requestParams: { id: DestinationIdSchema },
    requestBody: DestinationPatchInputSchema,
    responseSchema: DestinationAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);

        const result = await destinationService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});

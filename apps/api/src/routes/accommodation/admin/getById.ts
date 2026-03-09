/**
 * Admin get accommodation by ID endpoint
 * Returns full accommodation information including admin fields
 */
import { AccommodationAdminSchema, AccommodationIdSchema, PermissionEnum } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/accommodations/:id
 * Get accommodation by ID - Admin endpoint
 */
export const adminGetAccommodationByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get accommodation by ID (admin)',
    description: 'Retrieves full accommodation information including admin fields',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});

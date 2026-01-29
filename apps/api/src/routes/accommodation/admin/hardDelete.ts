/**
 * Admin hard delete accommodation endpoint
 * Permanently deletes an accommodation
 */
import { AccommodationIdSchema, PermissionEnum, type ServiceErrorCode } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/accommodations/:id/hard
 * Hard delete accommodation - Admin endpoint
 */
export const adminHardDeleteAccommodationRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete accommodation',
    description:
        'Permanently deletes an accommodation. Requires ACCOMMODATION_HARD_DELETE permission.',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_HARD_DELETE],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            success: true,
            message: 'Accommodation permanently deleted'
        };
    }
});

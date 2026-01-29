/**
 * Admin hard delete attraction endpoint
 * Permanently deletes an attraction
 */
import { AttractionIdSchema, PermissionEnum, type ServiceErrorCode } from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/attractions/:id/hard
 * Hard delete attraction - Admin endpoint
 */
export const adminHardDeleteAttractionRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete attraction',
    description: 'Permanently deletes an attraction. Requires ATTRACTION_HARD_DELETE permission.',
    tags: ['Attractions'],
    requiredPermissions: [PermissionEnum.ATTRACTION_HARD_DELETE],
    requestParams: {
        id: AttractionIdSchema
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await attractionService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return {
            success: true,
            message: 'Attraction permanently deleted'
        };
    }
});

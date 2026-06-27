/**
 * Admin hard delete experience listing endpoint.
 * Permanently deletes an experience listing.
 */
import { PermissionEnum } from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * DELETE /api/v1/admin/experiences/:id/hard
 * Hard delete experience listing — Admin endpoint.
 *
 * Permanently removes the experience listing from the database.
 * Requires COMMERCE_DELETE permission (reusing the same gate used for
 * hard deletes of other commerce entities until a dedicated
 * COMMERCE_HARD_DELETE permission is defined).
 */
export const adminHardDeleteExperienceRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete experience listing (admin)',
    description: 'Permanently deletes an experience listing. Requires COMMERCE_DELETE permission.',
    tags: ['Experience'],
    requiredPermissions: [PermissionEnum.COMMERCE_DELETE],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const experienceService = new ExperienceService({ logger: apiLogger });
        const result = await experienceService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true,
            message: 'Experience listing permanently deleted'
        };
    }
});

/**
 * Admin hard delete gastronomy listing endpoint.
 * Permanently deletes a gastronomy listing.
 */
import { PermissionEnum } from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * DELETE /api/v1/admin/gastronomies/:id/hard
 * Hard delete gastronomy listing — Admin endpoint.
 *
 * Permanently removes the gastronomy listing from the database.
 * Requires COMMERCE_DELETE permission (reusing the same gate used for
 * hard deletes of other commerce entities until a dedicated
 * COMMERCE_HARD_DELETE permission is defined).
 */
export const adminHardDeleteGastronomyRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}/hard',
    summary: 'Hard delete gastronomy listing (admin)',
    description: 'Permanently deletes a gastronomy listing. Requires COMMERCE_DELETE permission.',
    tags: ['Gastronomy'],
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
        const gastronomyService = new GastronomyService({ logger: apiLogger });
        const result = await gastronomyService.hardDelete(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true,
            message: 'Gastronomy listing permanently deleted'
        };
    }
});

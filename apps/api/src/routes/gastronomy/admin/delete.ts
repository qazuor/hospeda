/**
 * Admin soft delete gastronomy listing endpoint.
 * Allows admins to soft-delete any gastronomy listing.
 */
import { DeleteResultSchema, PermissionEnum } from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/gastronomies/:id
 * Soft delete gastronomy listing — Admin endpoint.
 *
 * Requires COMMERCE_DELETE permission. The service layer (`_canSoftDelete`)
 * enforces the same gate, providing defense in depth.
 */
export const adminDeleteGastronomyRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft delete gastronomy listing (admin)',
    description: 'Soft deletes a gastronomy listing. Requires COMMERCE_DELETE permission.',
    tags: ['Gastronomy'],
    requiredPermissions: [PermissionEnum.COMMERCE_DELETE],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const result = await gastronomyService.softDelete(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            deleted: result.data?.count > 0,
            id
        };
    }
});

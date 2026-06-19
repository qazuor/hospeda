/**
 * Admin restore gastronomy listing endpoint.
 * Restores a soft-deleted gastronomy listing.
 */
import { GastronomyAdminSchema, PermissionEnum } from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * POST /api/v1/admin/gastronomies/:id/restore
 * Restore gastronomy listing — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service layer (`_canRestore`)
 * enforces the same gate.
 */
export const adminRestoreGastronomyRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore gastronomy listing (admin)',
    description:
        'Restores a soft-deleted gastronomy listing. Requires COMMERCE_EDIT_ALL permission.',
    tags: ['Gastronomy'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const restoreResult = await gastronomyService.restore(actor, id);

        if (restoreResult.error) {
            throw new ServiceError(restoreResult.error.code, restoreResult.error.message);
        }

        const fetchResult = await gastronomyService.getById(actor, id);

        if (fetchResult.error) {
            throw new ServiceError(fetchResult.error.code, fetchResult.error.message);
        }

        return fetchResult.data;
    }
});

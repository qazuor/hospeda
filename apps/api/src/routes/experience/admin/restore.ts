/**
 * Admin restore experience listing endpoint.
 * Restores a soft-deleted experience listing.
 */
import { ExperienceAdminSchema, PermissionEnum } from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * POST /api/v1/admin/experiences/:id/restore
 * Restore experience listing — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service layer (`_canRestore`)
 * enforces the same gate.
 */
export const adminRestoreExperienceRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore experience listing (admin)',
    description:
        'Restores a soft-deleted experience listing. Requires COMMERCE_EDIT_ALL permission.',
    tags: ['Experience'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ExperienceAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const restoreResult = await experienceService.restore(actor, id);

        if (restoreResult.error) {
            throw new ServiceError(restoreResult.error.code, restoreResult.error.message);
        }

        const fetchResult = await experienceService.getById(actor, id);

        if (fetchResult.error) {
            throw new ServiceError(fetchResult.error.code, fetchResult.error.message);
        }

        return fetchResult.data;
    }
});

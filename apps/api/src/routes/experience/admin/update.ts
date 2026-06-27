/**
 * Admin update experience listing endpoint (full PUT).
 * Allows admins to update any experience listing.
 */
import {
    ExperienceAdminSchema,
    type ExperienceUpdateInput,
    ExperienceUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/experiences/:id
 * Update experience listing — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service layer (`_canUpdate`)
 * enforces the same gate, providing defense in depth.
 */
export const adminUpdateExperienceRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update experience listing (admin)',
    description: 'Updates an experience listing. Requires COMMERCE_EDIT_ALL permission.',
    tags: ['Experience'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: ExperienceUpdateInputSchema,
    responseSchema: ExperienceAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as ExperienceUpdateInput;

        const result = await experienceService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

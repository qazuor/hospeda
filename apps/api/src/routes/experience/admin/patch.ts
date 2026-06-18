/**
 * Admin patch experience listing endpoint (partial PATCH).
 * Allows admins to partially update any experience listing.
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
 * PATCH /api/v1/admin/experiences/:id
 * Partial update experience listing — Admin endpoint.
 *
 * Uses the same `ExperienceUpdateInputSchema` (all fields partial) as the PUT
 * endpoint. Requires COMMERCE_EDIT_ALL permission.
 */
export const adminPatchExperienceRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update experience listing (admin)',
    description:
        'Updates specific fields of an experience listing. Requires COMMERCE_EDIT_ALL permission.',
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
        const id = params.id as string;
        const data = body as ExperienceUpdateInput;

        const result = await experienceService.update(actor, id, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});

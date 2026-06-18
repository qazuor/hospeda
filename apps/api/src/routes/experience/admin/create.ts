/**
 * Admin create experience endpoint
 * Allows admins to create new experience listings.
 */
import {
    type ExperienceAdminCreateInput,
    ExperienceAdminCreateInputSchema,
    ExperienceAdminSchema,
    PermissionEnum
} from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * POST /api/v1/admin/experiences
 * Create experience listing — Admin endpoint.
 *
 * Requires COMMERCE_CREATE permission.
 */
export const adminCreateExperienceRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create experience listing',
    description: 'Creates a new experience listing. Requires COMMERCE_CREATE permission.',
    tags: ['Experience'],
    requiredPermissions: [PermissionEnum.COMMERCE_CREATE],
    requestBody: ExperienceAdminCreateInputSchema,
    responseSchema: ExperienceAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as ExperienceAdminCreateInput;

        const result = await experienceService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

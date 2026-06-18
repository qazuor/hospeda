/**
 * Admin get experience listing by ID endpoint.
 * Returns full experience information including admin fields.
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
 * GET /api/v1/admin/experiences/:id
 * Get experience listing by ID — Admin endpoint.
 *
 * Gate requires COMMERCE_VIEW_ALL; the service layer additionally enforces
 * entity-level visibility (owned vs. all).
 */
export const adminGetExperienceByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get experience listing by ID (admin)',
    description:
        'Retrieves full experience listing information including admin fields. Requires COMMERCE_VIEW_ALL.',
    tags: ['Experience'],
    requiredPermissions: [PermissionEnum.COMMERCE_VIEW_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ExperienceAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await experienceService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? null;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});

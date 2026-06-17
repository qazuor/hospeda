/**
 * Admin get gastronomy listing by ID endpoint.
 * Returns full gastronomy information including admin fields.
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
 * GET /api/v1/admin/gastronomies/:id
 * Get gastronomy listing by ID — Admin endpoint.
 *
 * Gate requires COMMERCE_VIEW_ALL; the service layer additionally enforces
 * entity-level visibility (owned vs. all).
 */
export const adminGetGastronomyByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get gastronomy listing by ID (admin)',
    description:
        'Retrieves full gastronomy listing information including admin fields. Requires COMMERCE_VIEW_ALL.',
    tags: ['Gastronomy'],
    requiredPermissions: [PermissionEnum.COMMERCE_VIEW_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyAdminSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await gastronomyService.getById(actor, params.id as string);

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

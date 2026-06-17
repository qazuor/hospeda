/**
 * Admin create gastronomy endpoint
 * Allows admins to create new gastronomy listings.
 */
import {
    type GastronomyAdminCreateInput,
    GastronomyAdminCreateInputSchema,
    GastronomyAdminSchema,
    PermissionEnum
} from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * POST /api/v1/admin/gastronomies
 * Create gastronomy listing — Admin endpoint.
 *
 * Requires COMMERCE_CREATE permission.
 */
export const adminCreateGastronomyRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create gastronomy listing',
    description: 'Creates a new gastronomy listing. Requires COMMERCE_CREATE permission.',
    tags: ['Gastronomy'],
    requiredPermissions: [PermissionEnum.COMMERCE_CREATE],
    requestBody: GastronomyAdminCreateInputSchema,
    responseSchema: GastronomyAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as GastronomyAdminCreateInput;

        const result = await gastronomyService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

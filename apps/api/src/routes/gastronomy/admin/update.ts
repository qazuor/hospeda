/**
 * Admin update gastronomy listing endpoint (full PUT).
 * Allows admins to update any gastronomy listing.
 */
import {
    GastronomyAdminSchema,
    type GastronomyUpdateInput,
    GastronomyUpdateInputSchema,
    PermissionEnum
} from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * PUT /api/v1/admin/gastronomies/:id
 * Update gastronomy listing — Admin endpoint.
 *
 * Requires COMMERCE_EDIT_ALL permission. The service layer (`_canUpdate`)
 * enforces the same gate, providing defense in depth.
 */
export const adminUpdateGastronomyRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update gastronomy listing (admin)',
    description: 'Updates a gastronomy listing. Requires COMMERCE_EDIT_ALL permission.',
    tags: ['Gastronomy'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: GastronomyUpdateInputSchema,
    responseSchema: GastronomyAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;
        const data = body as GastronomyUpdateInput;

        const result = await gastronomyService.update(actor, id as string, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

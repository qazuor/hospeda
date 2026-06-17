/**
 * Admin patch gastronomy listing endpoint (partial PATCH).
 * Allows admins to partially update any gastronomy listing.
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
 * PATCH /api/v1/admin/gastronomies/:id
 * Partial update gastronomy listing — Admin endpoint.
 *
 * Uses the same `GastronomyUpdateInputSchema` (all fields partial) as the PUT
 * endpoint. Requires COMMERCE_EDIT_ALL permission.
 */
export const adminPatchGastronomyRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update gastronomy listing (admin)',
    description:
        'Updates specific fields of a gastronomy listing. Requires COMMERCE_EDIT_ALL permission.',
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
        const id = params.id as string;
        const data = body as GastronomyUpdateInput;

        const result = await gastronomyService.update(actor, id, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        customRateLimit: { requests: 20, windowMs: 60000 }
    }
});

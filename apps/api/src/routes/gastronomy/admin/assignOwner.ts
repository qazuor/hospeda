/**
 * POST /api/v1/admin/gastronomies/:id/assign-owner
 * Set or replace the COMMERCE_OWNER of a gastronomy listing — Admin endpoint.
 *
 * Uses the dedicated `GastronomyService.assignOwner()` action. The generic
 * `update()` path intentionally omits `ownerId` (ownership is immutable there),
 * so routing assignment through it silently dropped the change.
 */
import { GastronomyAdminSchema, PermissionEnum } from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/** Body schema for the assign-owner endpoint. */
const AssignOwnerBodySchema = z.object({
    /** UUID of the user to assign as the new owner. */
    ownerId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/**
 * POST /api/v1/admin/gastronomies/:id/assign-owner
 * Assign owner to gastronomy listing — Admin endpoint.
 *
 * Delegates to `GastronomyService.assignOwner(actor, id, ownerId)`.
 * Requires COMMERCE_EDIT_ALL permission.
 */
export const adminAssignGastronomyOwnerRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/assign-owner',
    summary: 'Assign owner to gastronomy listing (admin)',
    description:
        'Sets or replaces the owner of a gastronomy listing. Requires COMMERCE_EDIT_ALL permission.',
    tags: ['Gastronomy'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: AssignOwnerBodySchema,
    responseSchema: GastronomyAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { ownerId } = AssignOwnerBodySchema.parse(body);

        // Dedicated ownership action: writes the owner FK directly. The generic
        // update() path omits ownerId by design, so it cannot be used here.
        const result = await gastronomyService.assignOwner(actor, params.id as string, ownerId);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

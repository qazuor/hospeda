/**
 * POST /api/v1/admin/experiences/:id/assign-owner
 * Set or replace the COMMERCE_OWNER of an experience listing — Admin endpoint.
 *
 * Uses the dedicated `ExperienceService.assignOwner()` action. The generic
 * `update()` path intentionally omits `ownerId` (ownership is immutable there),
 * so routing assignment through it silently dropped the change.
 */
import { ExperienceAdminSchema, PermissionEnum } from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/** Body schema for the assign-owner endpoint. */
const AssignOwnerBodySchema = z.object({
    /** UUID of the user to assign as the new owner. */
    ownerId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/**
 * POST /api/v1/admin/experiences/:id/assign-owner
 * Assign owner to experience listing — Admin endpoint.
 *
 * Delegates to `ExperienceService.update(actor, id, { ownerId })`.
 * No dedicated service method exists for assign-owner; using `update` with a
 * narrow payload is the established commerce-entity pattern.
 * Requires COMMERCE_EDIT_ALL permission.
 */
export const adminAssignExperienceOwnerRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/assign-owner',
    summary: 'Assign owner to experience listing (admin)',
    description:
        'Sets or replaces the owner of an experience listing. Requires COMMERCE_EDIT_ALL permission.',
    tags: ['Experience'],
    requiredPermissions: [PermissionEnum.COMMERCE_EDIT_ALL],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: AssignOwnerBodySchema,
    responseSchema: ExperienceAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { ownerId } = AssignOwnerBodySchema.parse(body);

        // Dedicated ownership action: writes the owner FK directly. The generic
        // update() path omits ownerId by design, so it cannot be used here.
        const result = await experienceService.assignOwner(actor, params.id as string, ownerId);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

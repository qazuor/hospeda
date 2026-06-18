/**
 * POST /api/v1/admin/experiences/:id/assign-owner
 * Set or replace the COMMERCE_OWNER of an experience listing — Admin endpoint.
 *
 * Uses `ExperienceService.update()` with `{ ownerId }` as the payload,
 * since no dedicated `setOwner` / `assignOwner` method exists on the service.
 * The PATCH body is intentionally narrow (only `ownerId`) to prevent forged
 * fields from reaching the update path.
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

        // Delegate to the generic update path — the service enforces COMMERCE_EDIT_ALL
        // via `_canUpdate` → `checkExperienceCanEditAll`.
        // TYPE-WORKAROUND: ExperienceUpdateInput omits ownerId (server-managed after
        // creation via the generic PATCH path); we pass it explicitly here through the
        // admin assign-owner action, which is the only sanctioned path to change ownership.
        const result = await experienceService.update(
            actor,
            params.id as string,
            { ownerId } as Parameters<typeof experienceService.update>[2]
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

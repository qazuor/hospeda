/**
 * Admin SYSTEM tag update endpoint (PATCH — partial update)
 * Updates an existing SYSTEM tag. Rejects type change attempts (D-002).
 *
 * @see SPEC-086 D-002, D-017, D-018
 */
import { TagModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, TagSchema, TagUpdateInputSchema } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../../utils/actor';
import { apiLogger } from '../../../../../utils/logger';
import { createAdminRoute } from '../../../../../utils/route-factory';

const tagService = new TagService({ logger: apiLogger });

/** Path parameter schema for tag ID */
const TagIdSchema = z
    .string({ message: 'zodError.common.id.required' })
    .uuid({ message: 'zodError.common.id.invalidUuid' });

/**
 * PATCH /api/v1/admin/tags/system/:id
 * Update SYSTEM tag — Admin endpoint
 *
 * Patchable fields: name, color, icon, description, lifecycleState.
 * Immutable fields: type (D-002), ownerId. Rejects any attempt to change type.
 * Requires TAG_SYSTEM_UPDATE permission.
 */
export const adminUpdateSystemTagRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Update SYSTEM tag',
    description:
        'Partially updates a SYSTEM tag by ID. type is immutable (D-002) — providing type in the body returns 400. Requires TAG_SYSTEM_UPDATE permission.',
    tags: ['Tags', 'System'],
    requiredPermissions: [PermissionEnum.TAG_SYSTEM_UPDATE],
    requestParams: { id: TagIdSchema },
    requestBody: TagUpdateInputSchema,
    responseSchema: TagSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const input = body as z.infer<typeof TagUpdateInputSchema>;

        // Verify tag exists and is SYSTEM
        const tagModel = new TagModel();
        const tag = await tagModel.findById(id);
        if (!tag) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Tag not found: ${id}`);
        }
        if ((tag as { type?: string }).type !== 'SYSTEM') {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Tag not found: ${id}`);
        }

        // Reject type change attempts (D-002)
        if ('type' in input && input.type !== undefined) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'type is immutable and cannot be changed (D-002)'
            );
        }

        apiLogger.debug(`[adminUpdateSystemTag] actor=${actor.id} tagId=${id}`);

        const result = await tagService.update(actor, id, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

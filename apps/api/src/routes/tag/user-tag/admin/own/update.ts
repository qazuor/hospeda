/**
 * Admin own USER tag update endpoint (PATCH — partial update)
 * Updates a USER tag owned by the calling actor
 *
 * Owner check is enforced by TagService.updateOwnTag() — the service rejects
 * updates to tags the actor does not own. type and ownerId are immutable (D-002).
 *
 * @see SPEC-086 D-002, D-017, D-022
 */
import { PermissionEnum, TagSchema, TagUpdateInputSchema } from '@repo/schemas';
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
 * PATCH /api/v1/admin/tags/own/:id
 * Update own USER tag — Admin endpoint
 *
 * Patchable fields: name, color, icon, description, lifecycleState.
 * Immutable fields: type (D-002), ownerId. Service enforces ownership.
 * Requires TAG_USER_UPDATE_OWN permission.
 */
export const adminUpdateOwnTagRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Update own USER tag',
    description:
        'Partially updates a USER tag owned by the calling actor. type and ownerId are immutable (D-002). Service enforces ownership — returns 403 if tag belongs to another user. Requires TAG_USER_UPDATE_OWN permission.',
    tags: ['Tags', 'OwnTags'],
    requiredPermissions: [PermissionEnum.TAG_USER_UPDATE_OWN],
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

        apiLogger.debug(`[adminUpdateOwnTag] actor=${actor.id} tagId=${id}`);

        // updateOwnTag enforces ownership and immutability (D-002, D-022)
        const result = await tagService.updateOwnTag(id, input, actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

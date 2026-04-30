/**
 * Admin own USER tag create endpoint
 * Creates a new USER tag for the calling actor
 *
 * Forces type=USER and ownerId=actor.id server-side.
 * Enforces per-user quota (D-021) and cross-type name collision (D-018).
 *
 * @see SPEC-086 D-002, D-017, D-018, D-021, AC-001-01..04
 */
import { PermissionEnum, TagColorEnumSchema, TagSchema, TagUpdateInputSchema } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../../utils/actor';
import { apiLogger } from '../../../../../utils/logger';
import { createAdminRoute } from '../../../../../utils/route-factory';

const tagService = new TagService({ logger: apiLogger });

/**
 * Request body for creating a USER tag.
 * type and ownerId are excluded — both are forced server-side.
 */
const CreateUserTagBodySchema = TagUpdateInputSchema.extend({
    name: z.string().min(1).max(255),
    color: TagColorEnumSchema
});

/**
 * POST /api/v1/admin/tags/own
 * Create own USER tag — Admin endpoint
 *
 * Forces type=USER and ownerId=actor.id via TagService.createUserTag().
 * Quota enforcement (default 50 ACTIVE USER tags per user, D-021) and advisory
 * lock (D-010) are applied by the service layer.
 * Requires TAG_USER_CREATE permission.
 */
export const adminCreateOwnTagRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create own USER tag',
    description:
        'Creates a new USER tag for the calling actor. type=USER and ownerId=actor.id are forced server-side. Quota and advisory lock enforced by service (D-010, D-021). Cross-type name collision returns 409 (D-018). Requires TAG_USER_CREATE permission.',
    tags: ['Tags', 'OwnTags'],
    requiredPermissions: [PermissionEnum.TAG_USER_CREATE],
    requestBody: CreateUserTagBodySchema,
    responseSchema: TagSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof CreateUserTagBodySchema>;

        // createUserTag forces type=USER and ownerId=actor.id (D-002, D-021)
        const result = await tagService.createUserTag(input, actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

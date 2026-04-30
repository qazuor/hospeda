/**
 * Admin SYSTEM tag create endpoint
 * Creates a new SYSTEM tag (admin only)
 *
 * The `type` field is forced to SYSTEM server-side — callers cannot override it.
 * `ownerId` must be absent (SYSTEM tags are never user-owned per D-002).
 *
 * @see SPEC-086 D-002, D-017, D-018
 */
import {
    LifecycleStatusEnum,
    PermissionEnum,
    TagColorEnumSchema,
    TagSchema,
    TagTypeEnum,
    TagUpdateInputSchema
} from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../../utils/actor';
import { apiLogger } from '../../../../../utils/logger';
import { createAdminRoute } from '../../../../../utils/route-factory';

const tagService = new TagService({ logger: apiLogger });

/**
 * Request body for creating a SYSTEM tag.
 * `type` and `ownerId` are excluded — both are forced server-side.
 */
const CreateSystemTagBodySchema = TagUpdateInputSchema.extend({
    name: z.string().min(1).max(255),
    color: TagColorEnumSchema
});

/**
 * POST /api/v1/admin/tags/system
 * Create SYSTEM tag — Admin endpoint
 *
 * Forces `type=SYSTEM` and `ownerId=null` regardless of request body.
 * Requires TAG_SYSTEM_CREATE permission.
 */
export const adminCreateSystemTagRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create SYSTEM tag',
    description:
        'Creates a new SYSTEM tag. type is forced to SYSTEM server-side. ownerId must be absent. Name must be unique among SYSTEM tags (D-018). Requires TAG_SYSTEM_CREATE permission.',
    tags: ['Tags', 'System'],
    requiredPermissions: [PermissionEnum.TAG_SYSTEM_CREATE],
    requestBody: CreateSystemTagBodySchema,
    responseSchema: TagSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof CreateSystemTagBodySchema>;

        // Force type=SYSTEM, ownerId=undefined — cannot be overridden by caller (D-002)
        const result = await tagService.create(actor, {
            ...input,
            type: TagTypeEnum.SYSTEM,
            ownerId: undefined,
            lifecycleState: input.lifecycleState ?? LifecycleStatusEnum.ACTIVE
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

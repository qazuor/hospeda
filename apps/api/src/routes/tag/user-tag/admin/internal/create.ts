/**
 * Admin INTERNAL tag create endpoint
 * Creates a new INTERNAL tag (admin only)
 *
 * The `type` field is forced to INTERNAL server-side — callers cannot override it.
 * `ownerId` must be absent (INTERNAL tags are never user-owned per D-002).
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
 * Request body for creating an INTERNAL tag.
 * `type` and `ownerId` are excluded — both are forced server-side.
 */
const CreateInternalTagBodySchema = TagUpdateInputSchema.extend({
    name: z.string().min(1).max(255),
    color: TagColorEnumSchema
});

/**
 * POST /api/v1/admin/tags/internal
 * Create INTERNAL tag — Admin endpoint
 *
 * Forces `type=INTERNAL` and `ownerId=null` regardless of request body.
 * Requires TAG_INTERNAL_CREATE permission.
 */
export const adminCreateInternalTagRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create INTERNAL tag',
    description:
        'Creates a new INTERNAL tag. type is forced to INTERNAL server-side. ownerId must be absent. Name must be unique among INTERNAL tags and must not collide with SYSTEM tag names (D-018). Requires TAG_INTERNAL_CREATE permission.',
    tags: ['Tags', 'Internal'],
    requiredPermissions: [PermissionEnum.TAG_INTERNAL_CREATE],
    requestBody: CreateInternalTagBodySchema,
    responseSchema: TagSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof CreateInternalTagBodySchema>;

        // Force type=INTERNAL, ownerId=undefined — cannot be overridden by caller (D-002)
        const result = await tagService.create(actor, {
            ...input,
            type: TagTypeEnum.INTERNAL,
            ownerId: undefined,
            lifecycleState: input.lifecycleState ?? LifecycleStatusEnum.ACTIVE
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

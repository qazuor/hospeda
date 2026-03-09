/**
 * Admin create tag endpoint
 * Allows admins to create new tags
 */
import {
    PermissionEnum,
    type TagCreateInput,
    TagCreateInputSchema,
    TagSchema
} from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const tagService = new TagService({ logger: apiLogger });

/**
 * POST /api/v1/admin/tags
 * Create tag - Admin endpoint
 */
export const adminCreateTagRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create tag',
    description: 'Creates a new tag. Admin only.',
    tags: ['Tags'],
    requiredPermissions: [PermissionEnum.TAG_CREATE],
    requestBody: TagCreateInputSchema,
    responseSchema: TagSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const data = body as TagCreateInput;

        const result = await tagService.create(actor, data);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

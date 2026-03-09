/**
 * Admin patch tag endpoint
 * Allows admins to partially update any tag
 */
import { PermissionEnum, TagIdSchema, TagPatchInputSchema, TagSchema } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { transformApiInputToDomain } from '../../../utils/openapi-schema.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const tagService = new TagService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/tags/:id
 * Partial update tag - Admin endpoint
 */
export const adminPatchTagRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update tag (admin)',
    description: 'Updates specific fields of any tag. Admin only.',
    tags: ['Tags'],
    requiredPermissions: [PermissionEnum.TAG_UPDATE],
    requestParams: {
        id: TagIdSchema
    },
    requestBody: TagPatchInputSchema,
    responseSchema: TagSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);

        const result = await tagService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: { customRateLimit: { requests: 20, windowMs: 60000 } }
});

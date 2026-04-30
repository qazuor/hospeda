/**
 * Admin INTERNAL tag get-by-ID endpoint
 * Returns a single INTERNAL tag by its UUID
 *
 * @see SPEC-086 D-002, D-006, D-017
 */
import { TagModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, TagSchema } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../../utils/actor';
import { apiLogger } from '../../../../../utils/logger';
import { createAdminRoute } from '../../../../../utils/route-factory';

/** Path parameter schema for tag ID */
const TagIdSchema = z
    .string({ message: 'zodError.common.id.required' })
    .uuid({ message: 'zodError.common.id.invalidUuid' });

const tagModel = new TagModel();

/**
 * GET /api/v1/admin/tags/internal/:id
 * Get INTERNAL tag by ID — Admin endpoint
 *
 * Verifies the tag is of type INTERNAL. Returns 404 if not found or if
 * the tag is not INTERNAL (prevents information leak about other tag types).
 * Requires TAG_INTERNAL_VIEW permission.
 */
export const adminGetInternalTagByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get INTERNAL tag by ID (admin)',
    description:
        'Retrieves a single INTERNAL tag by its UUID. Returns 404 if the tag does not exist or is not an INTERNAL tag. Requires TAG_INTERNAL_VIEW permission.',
    tags: ['Tags', 'Internal'],
    requiredPermissions: [PermissionEnum.TAG_INTERNAL_VIEW],
    requestParams: { id: TagIdSchema },
    responseSchema: TagSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        if (!actor.permissions.includes(PermissionEnum.TAG_INTERNAL_VIEW)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: TAG_INTERNAL_VIEW required'
            );
        }

        apiLogger.debug(`[adminGetInternalTagById] actor=${actor.id} tagId=${id}`);

        const tag = await tagModel.findById(id);

        if (!tag) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Tag not found: ${id}`);
        }

        if ((tag as { type?: string }).type !== 'INTERNAL') {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Tag not found: ${id}`);
        }

        return tag;
    }
});

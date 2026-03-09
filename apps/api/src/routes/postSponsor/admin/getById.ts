/**
 * Admin get post sponsor by ID endpoint
 * Returns full post sponsor information including admin fields
 */
import { PermissionEnum, PostSponsorIdSchema, PostSponsorSchema } from '@repo/schemas';
import { PostSponsorService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postSponsorService = new PostSponsorService({ logger: apiLogger });

/**
 * GET /api/v1/admin/post-sponsors/:id
 * Get post sponsor by ID - Admin endpoint
 */
export const adminGetPostSponsorByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get post sponsor by ID (admin)',
    description: 'Retrieves full post sponsor information including admin fields',
    tags: ['Post Sponsors'],
    requiredPermissions: [PermissionEnum.POST_SPONSOR_VIEW],
    requestParams: {
        id: PostSponsorIdSchema
    },
    responseSchema: PostSponsorSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await postSponsorService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});

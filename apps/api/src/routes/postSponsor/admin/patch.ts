/**
 * Admin patch post sponsor endpoint
 * Allows admins to partially update any post sponsor
 * NOTE: PostSponsor has no PatchInputSchema. Uses PostSponsorUpdateInputSchema (already partial).
 */
import {
    PermissionEnum,
    PostSponsorAdminSchema,
    PostSponsorIdSchema,
    PostSponsorUpdateInputSchema
} from '@repo/schemas';
import { PostSponsorService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { transformApiInputToDomain } from '../../../utils/openapi-schema';
import { createAdminRoute } from '../../../utils/route-factory';

const postSponsorService = new PostSponsorService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/post-sponsors/:id
 * Partial update post sponsor - Admin endpoint
 */
export const adminPatchPostSponsorRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update post sponsor (admin)',
    description: 'Updates specific fields of any post sponsor. Admin only.',
    tags: ['Post Sponsors'],
    requiredPermissions: [PermissionEnum.POST_SPONSOR_UPDATE],
    requestParams: { id: PostSponsorIdSchema },
    requestBody: PostSponsorUpdateInputSchema,
    responseSchema: PostSponsorAdminSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const domainInput = transformApiInputToDomain(body);
        const result = await postSponsorService.update(actor, id, domainInput as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: { customRateLimit: { requests: 20, windowMs: 60000 } }
});

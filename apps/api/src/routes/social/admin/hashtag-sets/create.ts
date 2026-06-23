/**
 * Admin create social hashtag set endpoint.
 *
 * Note: `slug` is optional — the service auto-generates it from `name`
 * in `_beforeCreate` when not supplied by the caller.
 */
import {
    PermissionEnum,
    SocialHashtagSetCreateSchema,
    SocialHashtagSetSchema
} from '@repo/schemas';
import { ServiceError, SocialHashtagSetService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const hashtagSetService = new SocialHashtagSetService({ logger: apiLogger });
// SocialHashtagSetCreateSchema already has slug optional (service auto-generates from name).

/**
 * POST /api/v1/admin/social/hashtag-sets
 * Create social hashtag set — Admin endpoint.
 */
export const adminCreateSocialHashtagSetRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create social hashtag set',
    description:
        'Creates a new social hashtag set. slug is auto-generated from name if not supplied.',
    tags: ['Social Hashtag Sets'],
    requiredPermissions: [PermissionEnum.SOCIAL_HASHTAG_SET_MANAGE],
    requestBody: SocialHashtagSetCreateSchema,
    responseSchema: SocialHashtagSetSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const result = await hashtagSetService.create(actor, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

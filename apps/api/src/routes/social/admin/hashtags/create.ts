/**
 * Admin create social hashtag endpoint.
 * Allows admins to create new hashtag catalog entries.
 *
 * Note: `normalizedHashtag` is made optional here — the service derives it
 * from `hashtag` in `_beforeCreate` (lowercase + `#` prefix normalization).
 * The HTTP input schema uses `.partial({ normalizedHashtag: true })` to avoid
 * requiring a computed field from the caller.
 */
import { PermissionEnum, SocialHashtagCreateSchema, SocialHashtagSchema } from '@repo/schemas';
import { ServiceError, SocialHashtagService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const hashtagService = new SocialHashtagService({ logger: apiLogger });
// SocialHashtagCreateSchema already has normalizedHashtag optional (service computes it from hashtag).

/**
 * POST /api/v1/admin/social/hashtags
 * Create social hashtag — Admin endpoint.
 */
export const adminCreateSocialHashtagRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create social hashtag',
    description: 'Creates a new social hashtag catalog entry. normalizedHashtag is auto-computed.',
    tags: ['Social Hashtags'],
    requiredPermissions: [PermissionEnum.SOCIAL_HASHTAG_MANAGE],
    requestBody: SocialHashtagCreateSchema,
    responseSchema: SocialHashtagSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const result = await hashtagService.create(actor, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

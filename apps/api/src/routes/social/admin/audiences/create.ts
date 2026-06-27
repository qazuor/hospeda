/**
 * Admin create social audience endpoint.
 *
 * Note: `slug` is optional — the service auto-generates it from `name`
 * in `_beforeCreate` when not supplied.
 */
import { PermissionEnum, SocialAudienceCreateSchema, SocialAudienceSchema } from '@repo/schemas';
import { ServiceError, SocialAudienceService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const audienceService = new SocialAudienceService({ logger: apiLogger });
// SocialAudienceCreateSchema already has slug optional (service auto-generates from name).

/**
 * POST /api/v1/admin/social/audiences
 * Create social audience — Admin endpoint.
 */
export const adminCreateSocialAudienceRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create social audience',
    description: 'Creates a new social audience. slug is auto-generated from name if not supplied.',
    tags: ['Social Audiences'],
    requiredPermissions: [PermissionEnum.SOCIAL_AUDIENCE_MANAGE],
    requestBody: SocialAudienceCreateSchema,
    responseSchema: SocialAudienceSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const result = await audienceService.create(actor, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

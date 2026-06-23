/**
 * Admin get social audience by ID endpoint.
 */
import { IdSchema, PermissionEnum, SocialAudienceSchema } from '@repo/schemas';
import { ServiceError, SocialAudienceService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const audienceService = new SocialAudienceService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/audiences/:id
 * Get social audience by ID — Admin endpoint.
 */
export const adminGetSocialAudienceByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get social audience by ID (admin)',
    description: 'Retrieves a social audience by ID',
    tags: ['Social Audiences'],
    requiredPermissions: [PermissionEnum.SOCIAL_AUDIENCE_MANAGE],
    requestParams: { id: IdSchema },
    responseSchema: SocialAudienceSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await audienceService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

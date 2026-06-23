/**
 * Admin partial update social audience endpoint.
 */
import {
    IdSchema,
    PermissionEnum,
    SocialAudienceSchema,
    SocialAudienceUpdateSchema
} from '@repo/schemas';
import { ServiceError, SocialAudienceService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const audienceService = new SocialAudienceService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/social/audiences/:id
 * Partial update social audience — Admin endpoint.
 */
export const adminPatchSocialAudienceRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update social audience (admin)',
    description: 'Updates specific fields of a social audience.',
    tags: ['Social Audiences'],
    requiredPermissions: [PermissionEnum.SOCIAL_AUDIENCE_MANAGE],
    requestParams: { id: IdSchema },
    requestBody: SocialAudienceUpdateSchema,
    responseSchema: SocialAudienceSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await audienceService.update(actor, id, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

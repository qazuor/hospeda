/**
 * Admin get social post footer by ID endpoint.
 */
import { IdSchema, PermissionEnum, SocialPostFooterSchema } from '@repo/schemas';
import { ServiceError, SocialPostFooterService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const footerService = new SocialPostFooterService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/footers/:id
 * Get social post footer by ID — Admin endpoint.
 */
export const adminGetSocialFooterByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get social post footer by ID (admin)',
    description: 'Retrieves a social post footer by ID',
    tags: ['Social Footers'],
    requiredPermissions: [PermissionEnum.SOCIAL_FOOTER_MANAGE],
    requestParams: { id: IdSchema },
    responseSchema: SocialPostFooterSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await footerService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

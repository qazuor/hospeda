/**
 * Admin partial update social post footer endpoint.
 */
import {
    IdSchema,
    PermissionEnum,
    SocialPostFooterSchema,
    SocialPostFooterUpdateSchema
} from '@repo/schemas';
import { ServiceError, SocialPostFooterService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const footerService = new SocialPostFooterService({ logger: apiLogger });

/**
 * PATCH /api/v1/admin/social/footers/:id
 * Partial update social post footer — Admin endpoint.
 */
export const adminPatchSocialFooterRoute = createAdminRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partial update social post footer (admin)',
    description: 'Updates specific fields of a social post footer.',
    tags: ['Social Footers'],
    requiredPermissions: [PermissionEnum.SOCIAL_FOOTER_MANAGE],
    requestParams: { id: IdSchema },
    requestBody: SocialPostFooterUpdateSchema,
    responseSchema: SocialPostFooterSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await footerService.update(actor, id, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

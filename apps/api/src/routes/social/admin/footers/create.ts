/**
 * Admin create social post footer endpoint.
 *
 * Note: `slug` is optional — the service auto-generates it from `name`
 * in `_beforeCreate` when not supplied.
 */
import {
    PermissionEnum,
    SocialPostFooterCreateSchema,
    SocialPostFooterSchema
} from '@repo/schemas';
import { ServiceError, SocialPostFooterService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const footerService = new SocialPostFooterService({ logger: apiLogger });
// SocialPostFooterCreateSchema already has slug optional (service auto-generates from name).

/**
 * POST /api/v1/admin/social/footers
 * Create social post footer — Admin endpoint.
 */
export const adminCreateSocialFooterRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create social post footer',
    description:
        'Creates a new social post footer. slug is auto-generated from name if not supplied.',
    tags: ['Social Footers'],
    requiredPermissions: [PermissionEnum.SOCIAL_FOOTER_MANAGE],
    requestBody: SocialPostFooterCreateSchema,
    responseSchema: SocialPostFooterSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const result = await footerService.create(actor, body as never);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

/**
 * Admin create partner endpoint
 * Creates a new partner
 */
import { PermissionEnum, createPartnerSchema, partnerSchema } from '@repo/schemas';
import { PartnerService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const partnerService = new PartnerService({ logger: apiLogger });

/**
 * POST /api/v1/admin/partners
 * Create partner - Admin endpoint
 * Requires PARTNER_MANAGE permission
 */
export const adminCreatePartnerRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create partner (admin)',
    description: 'Creates a new partner',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestBody: createPartnerSchema,
    responseSchema: partnerSchema,
    handler: async (ctx, _params, body) => {
        const actor = getActorFromContext(ctx);

        const result = await partnerService.create(
            actor,
            body as Parameters<typeof partnerService.create>[1]
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

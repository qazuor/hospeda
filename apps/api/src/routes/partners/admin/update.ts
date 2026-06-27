import { PermissionEnum, partnerSchema, updatePartnerSchema } from '@repo/schemas';
import { PartnerService, ServiceError } from '@repo/service-core';
/**
 * Admin update partner endpoint
 * Updates an existing partner
 */
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * PUT /api/v1/admin/partners/{id}
 * Update partner - Admin endpoint
 * Requires PARTNER_MANAGE permission
 */
export const adminUpdatePartnerRoute = createAdminRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update partner (admin)',
    description: 'Updates an existing partner',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestParams: { id: z.string().uuid() },
    requestBody: updatePartnerSchema,
    responseSchema: partnerSchema,
    handler: async (ctx, params, body) => {
        const partnerService = new PartnerService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await partnerService.update(actor, id, body);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

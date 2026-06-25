import { PermissionEnum } from '@repo/schemas';
import { PartnerService, ServiceError } from '@repo/service-core';
/**
 * Admin delete partner endpoint
 * Soft deletes a partner
 */
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const partnerService = new PartnerService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/partners/{id}
 * Delete partner - Admin endpoint
 * Requires PARTNER_MANAGE permission
 */
export const adminDeletePartnerRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete partner (admin)',
    description: 'Soft deletes a partner',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestParams: { id: z.string().uuid() },
    responseSchema: z.object({
        success: z.literal(true),
        message: z.string()
    }),
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await partnerService.softDelete(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            success: true as const,
            message: 'Partner deleted successfully'
        };
    }
});

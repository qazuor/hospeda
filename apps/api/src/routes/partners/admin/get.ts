import { PermissionEnum, partnerSchema } from '@repo/schemas';
import { PartnerService, ServiceError } from '@repo/service-core';
/**
 * Admin get partner by ID endpoint
 * Returns a single partner with full admin details
 */
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/admin/partners/{id}
 * Get partner by ID - Admin endpoint
 * Requires PARTNER_VIEW_ALL permission
 */
export const adminGetPartnerRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get partner by ID (admin)',
    description: 'Returns a single partner with full admin details',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_VIEW_ALL],
    requestParams: { id: z.string().uuid() },
    responseSchema: partnerSchema,
    handler: async (ctx, params) => {
        const partnerService = new PartnerService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await partnerService.getById(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Partner not found'
                    }
                },
                404
            );
        }

        return result.data;
    }
});

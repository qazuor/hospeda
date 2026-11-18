/**
 * Admin get-by-id endpoint for partner types (HOS-2336).
 */
import { PartnerTypeAdminSchema, PartnerTypeIdSchema, PermissionEnum } from '@repo/schemas';
import { PartnerTypeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const partnerTypeService = new PartnerTypeService({ logger: apiLogger });

/**
 * GET /api/v1/admin/partner-types/:id
 */
export const adminGetPartnerTypeByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get partner type by ID (admin)',
    description: 'Retrieves a partner type with all admin fields.',
    tags: ['PartnerTypes'],
    requiredPermissions: [PermissionEnum.PARTNER_TYPE_VIEW],
    requestParams: { id: PartnerTypeIdSchema },
    responseSchema: PartnerTypeAdminSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await partnerTypeService.getById(actor, params.id as string);
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    }
});

/**
 * Admin soft-delete endpoint for partner types (HOS-2336).
 */
import { DeleteResultSchema, PartnerTypeIdSchema, PermissionEnum } from '@repo/schemas';
import { PartnerTypeService, purgePartnerTypesCache, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const partnerTypeService = new PartnerTypeService({ logger: apiLogger });

/**
 * DELETE /api/v1/admin/partner-types/:id
 * Soft delete only. Answers 409 PARTNER_TYPE_IN_USE (with `details.count`)
 * while a non-deleted partner uses the type (AC-3.4).
 */
export const adminDeletePartnerTypeRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Soft-delete partner type',
    description:
        'Soft-deletes a partner type. Answers 409 PARTNER_TYPE_IN_USE while non-deleted partners use it.',
    tags: ['PartnerTypes'],
    requiredPermissions: [PermissionEnum.PARTNER_TYPE_DELETE],
    requestParams: { id: PartnerTypeIdSchema },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await partnerTypeService.softDelete(actor, params.id as string);
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }
        await purgePartnerTypesCache({ triggeredBy: actor.id });
        return { deleted: (result.data?.count ?? 0) > 0, id: params.id };
    }
});

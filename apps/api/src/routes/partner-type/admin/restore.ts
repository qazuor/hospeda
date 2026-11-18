/**
 * Admin restore endpoint for partner types (HOS-2336).
 */
import { PartnerTypeAdminSchema, PartnerTypeIdSchema, PermissionEnum } from '@repo/schemas';
import { PartnerTypeService, purgePartnerTypesCache, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const partnerTypeService = new PartnerTypeService({ logger: apiLogger });

/**
 * POST /api/v1/admin/partner-types/:id/restore
 * Restores a soft-deleted type with its old slug and lifecycle state (AC-3.5).
 */
export const adminRestorePartnerTypeRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/restore',
    summary: 'Restore partner type',
    description: 'Restores a soft-deleted partner type. It keeps its original slug.',
    tags: ['PartnerTypes'],
    requiredPermissions: [PermissionEnum.PARTNER_TYPE_RESTORE],
    requestParams: { id: PartnerTypeIdSchema },
    responseSchema: PartnerTypeAdminSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const restored = await partnerTypeService.restore(actor, id);
        if (restored.error) {
            throw new ServiceError(
                restored.error.code,
                restored.error.message,
                restored.error.details
            );
        }
        await purgePartnerTypesCache({ triggeredBy: actor.id });
        const fetched = await partnerTypeService.getById(actor, id);
        if (fetched.error) throw new ServiceError(fetched.error.code, fetched.error.message);
        return fetched.data;
    }
});
